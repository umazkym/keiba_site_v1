"""Cloud RunとCloudflareの直近7日指標を段階公開ゲート用JSONへ集約する。"""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence


CAPACITY_SCHEMA_VERSION = "cloud-run-capacity.v2"


@dataclass(frozen=True)
class ServiceConfig:
    """Cloud Runの割当量と安全な最大インスタンス数。"""

    service_name: str
    cpu: float
    memory_gib: float
    max_instances: int


def parse_service_config(value: str) -> ServiceConfig:
    """`service,cpu,memory_gib,max_instances`を厳密に解釈する。"""

    parts = [part.strip() for part in value.split(",")]
    if len(parts) != 4 or not parts[0]:
        raise argparse.ArgumentTypeError(
            "--service-configはservice,cpu,memory_gib,max_instances形式で指定してください"
        )
    try:
        cpu = float(parts[1])
        memory_gib = float(parts[2])
        max_instances = int(parts[3])
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "cpuとmemory_gibは数値、max_instancesは整数で指定してください"
        ) from exc
    if cpu <= 0 or memory_gib <= 0 or max_instances <= 0:
        raise argparse.ArgumentTypeError(
            "cpu、memory_gib、max_instancesは0より大きい値にしてください"
        )
    return ServiceConfig(
        service_name=parts[0],
        cpu=cpu,
        memory_gib=memory_gib,
        max_instances=max_instances,
    )


def _numeric_value(point: Any) -> float:
    value = point.value
    protobuf_value = getattr(value, "_pb", value)
    which_oneof = getattr(protobuf_value, "WhichOneof", None)
    field = which_oneof("value") if callable(which_oneof) else None
    if field in {"double_value", "int64_value"}:
        return float(getattr(value, field))
    return 0.0


def _list_metric_values(
    client: Any,
    *,
    project_id: str,
    service_name: str,
    metric_type: str,
    start: datetime,
    end: datetime,
    alignment_seconds: int,
    aligner: Any,
    reducer: Any,
    extra_filter: str = "",
) -> list[float]:
    from google.cloud import monitoring_v3
    from google.protobuf import duration_pb2, timestamp_pb2

    start_ts = timestamp_pb2.Timestamp()
    start_ts.FromDatetime(start)
    end_ts = timestamp_pb2.Timestamp()
    end_ts.FromDatetime(end)
    metric_filter = (
        'resource.type="cloud_run_revision" '
        f'AND resource.labels.service_name="{service_name}" '
        f'AND metric.type="{metric_type}"'
    )
    if extra_filter:
        metric_filter = f"{metric_filter} AND {extra_filter}"
    request = monitoring_v3.ListTimeSeriesRequest(
        name=f"projects/{project_id}",
        filter=metric_filter,
        interval=monitoring_v3.TimeInterval(
            start_time=start_ts,
            end_time=end_ts,
        ),
        view=monitoring_v3.ListTimeSeriesRequest.TimeSeriesView.FULL,
        aggregation=monitoring_v3.Aggregation(
            alignment_period=duration_pb2.Duration(seconds=alignment_seconds),
            per_series_aligner=aligner,
            cross_series_reducer=reducer,
        ),
    )
    values: list[float] = []
    for series in client.list_time_series(request=request):
        values.extend(_numeric_value(point) for point in series.points)
    return values


def collect_cloud_run_metrics(
    *,
    project_id: str,
    service_config: ServiceConfig | None = None,
    service_name: str | None = None,
    max_instances: int | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    """1サービス分を収集する。旧呼び出し形式も互換維持する。"""

    from google.cloud import monitoring_v3

    config = service_config or ServiceConfig(
        service_name=service_name or "keiba-frontend-v1",
        cpu=1.0,
        memory_gib=1.0,
        max_instances=max_instances or 2,
    )
    end = now or datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    client = monitoring_v3.MetricServiceClient()
    aligners = monitoring_v3.Aggregation.Aligner
    reducers = monitoring_v3.Aggregation.Reducer

    billable_values = _list_metric_values(
        client,
        project_id=project_id,
        service_name=config.service_name,
        metric_type="run.googleapis.com/container/billable_instance_time",
        start=start,
        end=end,
        alignment_seconds=86400,
        aligner=aligners.ALIGN_SUM,
        reducer=reducers.REDUCE_SUM,
    )
    request_values = _list_metric_values(
        client,
        project_id=project_id,
        service_name=config.service_name,
        metric_type="run.googleapis.com/request_count",
        start=start,
        end=end,
        alignment_seconds=86400,
        aligner=aligners.ALIGN_SUM,
        reducer=reducers.REDUCE_SUM,
    )
    error_values = _list_metric_values(
        client,
        project_id=project_id,
        service_name=config.service_name,
        metric_type="run.googleapis.com/request_count",
        start=start,
        end=end,
        alignment_seconds=86400,
        aligner=aligners.ALIGN_SUM,
        reducer=reducers.REDUCE_SUM,
        extra_filter='metric.labels.response_code_class="5xx"',
    )
    latency_values = _list_metric_values(
        client,
        project_id=project_id,
        service_name=config.service_name,
        metric_type="run.googleapis.com/request_latencies",
        start=start,
        end=end,
        alignment_seconds=604800,
        aligner=aligners.ALIGN_PERCENTILE_95,
        reducer=reducers.REDUCE_PERCENTILE_95,
    )
    instance_values = _list_metric_values(
        client,
        project_id=project_id,
        service_name=config.service_name,
        metric_type="run.googleapis.com/container/instance_count",
        start=start,
        end=end,
        alignment_seconds=300,
        aligner=aligners.ALIGN_MAX,
        reducer=reducers.REDUCE_MAX,
        extra_filter='metric.labels.state="active"',
    )
    internet_egress_values = _list_metric_values(
        client,
        project_id=project_id,
        service_name=config.service_name,
        metric_type="run.googleapis.com/container/network/sent_bytes_count",
        start=start,
        end=end,
        alignment_seconds=86400,
        aligner=aligners.ALIGN_SUM,
        reducer=reducers.REDUCE_SUM,
        extra_filter='metric.labels.kind="internet"',
    )

    billable_seconds = sum(billable_values)
    request_count = sum(request_values)
    error_count = sum(error_values)
    internet_egress_bytes = sum(internet_egress_values)
    max_active_instances = max(instance_values, default=0.0)
    metrics_available = bool(
        billable_values or request_values or latency_values or instance_values
    )
    return {
        "service_name": config.service_name,
        "config": asdict(config),
        "cloud_run_metrics_available": metrics_available,
        "billable_instance_seconds_7d": round(billable_seconds, 3),
        "projected_monthly_vcpu_seconds": round(
            billable_seconds * config.cpu * 30 / 7,
            3,
        ),
        "projected_monthly_gib_seconds": round(
            billable_seconds * config.memory_gib * 30 / 7,
            3,
        ),
        "request_count_7d": int(request_count),
        "projected_monthly_requests": round(request_count * 30 / 7),
        "error_count_7d": int(error_count),
        "error_rate": error_count / request_count if request_count else 0.0,
        "p95_latency_ms": max(latency_values, default=0.0),
        "max_active_instances": max_active_instances,
        "max_instance_saturated": max_active_instances >= config.max_instances,
        "internet_egress_bytes_7d": round(internet_egress_bytes),
        "projected_monthly_internet_egress_bytes": round(
            internet_egress_bytes * 30 / 7
        ),
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
    }


def aggregate_cloud_run_metrics(
    service_metrics: Sequence[dict[str, Any]],
) -> dict[str, Any]:
    """複数サービスを無料枠共有単位へ合算する。"""

    request_count = sum(int(item.get("request_count_7d") or 0) for item in service_metrics)
    error_count = sum(int(item.get("error_count_7d") or 0) for item in service_metrics)
    saturated_services = [
        str(item.get("service_name"))
        for item in service_metrics
        if item.get("max_instance_saturated")
    ]
    available = bool(service_metrics) and all(
        bool(item.get("cloud_run_metrics_available")) for item in service_metrics
    )
    starts = [item.get("window_start") for item in service_metrics if item.get("window_start")]
    ends = [item.get("window_end") for item in service_metrics if item.get("window_end")]
    return {
        "schema_version": CAPACITY_SCHEMA_VERSION,
        "cloud_run_metrics_available": available,
        "required_services": [str(item.get("service_name")) for item in service_metrics],
        "services": {
            str(item.get("service_name")): item for item in service_metrics
        },
        "billable_instance_seconds_7d": round(
            sum(float(item.get("billable_instance_seconds_7d") or 0.0) for item in service_metrics),
            3,
        ),
        "projected_monthly_vcpu_seconds": round(
            sum(float(item.get("projected_monthly_vcpu_seconds") or 0.0) for item in service_metrics),
            3,
        ),
        "projected_monthly_gib_seconds": round(
            sum(float(item.get("projected_monthly_gib_seconds") or 0.0) for item in service_metrics),
            3,
        ),
        "request_count_7d": request_count,
        "projected_monthly_requests": round(
            sum(float(item.get("projected_monthly_requests") or 0.0) for item in service_metrics)
        ),
        "error_count_7d": error_count,
        "error_rate": error_count / request_count if request_count else 0.0,
        "p95_latency_ms": max(
            (float(item.get("p95_latency_ms") or 0.0) for item in service_metrics),
            default=0.0,
        ),
        "max_active_instances": max(
            (float(item.get("max_active_instances") or 0.0) for item in service_metrics),
            default=0.0,
        ),
        "max_instance_saturated": bool(saturated_services),
        "saturated_services": saturated_services,
        "internet_egress_bytes_7d": round(
            sum(float(item.get("internet_egress_bytes_7d") or 0.0) for item in service_metrics)
        ),
        "projected_monthly_internet_egress_bytes": round(
            sum(
                float(item.get("projected_monthly_internet_egress_bytes") or 0.0)
                for item in service_metrics
            )
        ),
        "window_start": min(starts) if starts else None,
        "window_end": max(ends) if ends else None,
    }


def collect_cloud_run_capacity(
    *,
    project_id: str,
    service_configs: Sequence[ServiceConfig],
    now: datetime | None = None,
) -> dict[str, Any]:
    """必須サービスを個別収集し、失敗したサービスも明示して返す。"""

    metrics: list[dict[str, Any]] = []
    errors: dict[str, str] = {}
    end = now or datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    for config in service_configs:
        try:
            item = collect_cloud_run_metrics(
                project_id=project_id,
                service_config=config,
                now=end,
            )
        except Exception as exc:  # noqa: BLE001 - 指標障害は公開停止へ縮退させる
            errors[config.service_name] = str(exc)
            item = {
                "service_name": config.service_name,
                "config": asdict(config),
                "cloud_run_metrics_available": False,
                "cloud_run_error": str(exc),
                "window_start": start.isoformat(),
                "window_end": end.isoformat(),
            }
        metrics.append(item)
    output = aggregate_cloud_run_metrics(metrics)
    if errors:
        output["cloud_run_errors"] = errors
    return output


def collect_cloudflare_cache_hit_ratio(
    *,
    zone_id: str,
    api_token: str,
    today: date | None = None,
) -> float | None:
    end_date = today or datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=6)
    query = """
query CacheRatio($zoneTag: string!, $dateGeq: Date!, $dateLeq: Date!) {
  viewer {
    zones(filter: {zoneTag: $zoneTag}) {
      httpRequests1dGroups(
        limit: 7
        filter: {date_geq: $dateGeq, date_leq: $dateLeq}
      ) {
        sum { cachedRequests requests }
      }
    }
  }
}
"""
    payload = json.dumps({
        "query": query,
        "variables": {
            "zoneTag": zone_id,
            "dateGeq": start_date.isoformat(),
            "dateLeq": end_date.isoformat(),
        },
    }).encode("utf-8")
    request = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/graphql",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (OSError, urllib.error.URLError, json.JSONDecodeError):
        return None
    if result.get("errors"):
        return None
    zones = (((result.get("data") or {}).get("viewer") or {}).get("zones") or [])
    groups: Iterable[dict[str, Any]] = zones[0].get("httpRequests1dGroups") or [] if zones else []
    requests = 0.0
    cached = 0.0
    for group in groups:
        sums = group.get("sum") or {}
        requests += float(sums.get("requests") or 0.0)
        cached += float(sums.get("cachedRequests") or 0.0)
    return cached / requests if requests else None


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id", default="keiba-api-project")
    parser.add_argument(
        "--service-config",
        action="append",
        type=parse_service_config,
        default=[],
        help="service,cpu,memory_gib,max_instances。複数回指定できます。",
    )
    parser.add_argument(
        "--service-name",
        default="keiba-frontend-v1",
        help="旧単一サービス形式との互換用",
    )
    parser.add_argument(
        "--max-instances",
        type=int,
        default=2,
        help="旧単一サービス形式との互換用",
    )
    parser.add_argument("--output-json", type=Path, required=True)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    service_configs = args.service_config or [
        ServiceConfig(
            service_name=args.service_name,
            cpu=1.0,
            memory_gib=1.0,
            max_instances=args.max_instances,
        )
    ]
    try:
        output = collect_cloud_run_capacity(
            project_id=args.project_id,
            service_configs=service_configs,
        )
    except Exception as exc:  # noqa: BLE001 - 最上位障害も安全側へ縮退
        output = {
            "schema_version": CAPACITY_SCHEMA_VERSION,
            "cloud_run_metrics_available": False,
            "required_services": [config.service_name for config in service_configs],
            "cloud_run_error": str(exc),
        }

    zone_id = os.getenv("CLOUDFLARE_ZONE_ID", "").strip()
    api_token = os.getenv("CLOUDFLARE_API_TOKEN", "").strip()
    output["cloudflare_cache_hit_ratio"] = (
        collect_cloudflare_cache_hit_ratio(zone_id=zone_id, api_token=api_token)
        if zone_id and api_token
        else None
    )
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
