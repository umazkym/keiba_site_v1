"""Cloud RunとCloudflareの直近7日指標を段階公開ゲート用JSONへ集約する。"""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Sequence


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
    service_name: str,
    max_instances: int,
    now: datetime | None = None,
) -> dict[str, Any]:
    from google.cloud import monitoring_v3

    end = now or datetime.now(timezone.utc)
    start = end - timedelta(days=7)
    client = monitoring_v3.MetricServiceClient()
    aligners = monitoring_v3.Aggregation.Aligner
    reducers = monitoring_v3.Aggregation.Reducer

    billable_values = _list_metric_values(
        client,
        project_id=project_id,
        service_name=service_name,
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
        service_name=service_name,
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
        service_name=service_name,
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
        service_name=service_name,
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
        service_name=service_name,
        metric_type="run.googleapis.com/container/instance_count",
        start=start,
        end=end,
        alignment_seconds=300,
        aligner=aligners.ALIGN_MAX,
        reducer=reducers.REDUCE_MAX,
        extra_filter='metric.labels.state="active"',
    )

    billable_seconds = sum(billable_values)
    request_count = sum(request_values)
    error_count = sum(error_values)
    return {
        "cloud_run_metrics_available": bool(
            billable_values or request_values or latency_values or instance_values
        ),
        "billable_instance_seconds_7d": round(billable_seconds, 3),
        # フロントサービスは1 vCPU固定のため、billable secondsをvCPU秒として扱える。
        "projected_monthly_vcpu_seconds": round(billable_seconds * 30 / 7, 3),
        "request_count_7d": int(request_count),
        "error_count_7d": int(error_count),
        "error_rate": error_count / request_count if request_count else 0.0,
        "p95_latency_ms": max(latency_values, default=0.0),
        "max_active_instances": max(instance_values, default=0.0),
        "max_instance_saturated": max(instance_values, default=0.0) >= max_instances,
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
    }


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
    parser.add_argument("--service-name", default="keiba-frontend-v1")
    parser.add_argument("--max-instances", type=int, default=2)
    parser.add_argument("--output-json", type=Path, required=True)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    output: dict[str, Any]
    try:
        output = collect_cloud_run_metrics(
            project_id=args.project_id,
            service_name=args.service_name,
            max_instances=args.max_instances,
        )
    except Exception as exc:  # noqa: BLE001 - 指標障害は公開停止へ縮退させる
        output = {
            "cloud_run_metrics_available": False,
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
