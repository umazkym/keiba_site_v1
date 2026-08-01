export type ArticleOrderItem = {
  file: string;
  order: any;
  priority: number;
};

export type ArticleOrderPriorityOptions = {
  maxArticles: number;
  reserveRaceUpdateSlot: boolean;
  reserveEvergreenSlot: boolean;
  aggressiveCoverage?: boolean;
};

export function isRaceUpdateOrder(order: any): boolean {
  const cluster = String(order?.theme_cluster || order?.reference_data?.article_type || '');
  return cluster === 'race_update';
}

export function isUrgentGradeRaceOrder(order: any): boolean {
  const ref = order?.reference_data || {};
  const entityType = String(order?.entity_type || ref.entity_type || '');
  const cluster = String(order?.theme_cluster || ref.article_type || '');
  const operation = String(order?.operation || '');
  const deadlineStatus = String(ref.deadline_status || '');
  const updateStage = String(ref.update_stage || '');
  if (operation === 'grade_race_search_repair' || cluster === 'grade_race_search_repair') {
    return true;
  }
  return (
    entityType === 'grade_race'
    && (cluster === 'race_update' || cluster === 'grade_race_preview')
    && (
      deadlineStatus === 'due_initial'
      || deadlineStatus === 'due_field_refresh'
      || deadlineStatus === 'due_race_week'
      || deadlineStatus === 'due_preview'
      || deadlineStatus === 'missed_preview'
      || deadlineStatus === 'due_result_review'
      || deadlineStatus === 'due_draw_confirmed'
      || deadlineStatus === 'due_final_48h'
      || deadlineStatus === 'due_race_morning'
      || deadlineStatus === 'due_post_race'
      || updateStage === 'draw_confirmed'
      || updateStage === 'final_48h'
      || updateStage === 'race_morning'
      || updateStage === 'post_race'
    )
  );
}

export function isEvergreenOrder(order: any): boolean {
  const cluster = String(order?.theme_cluster || order?.reference_data?.article_type || '');
  const category = String(order?.category || order?.reference_data?.category || '');
  if (cluster === 'race_update' || cluster === 'grade_race_preview') return false;
  if (['course_venue', 'jockey_profile', 'beginner_guide', 'guide'].includes(cluster)) {
    return true;
  }
  return ['コース分析', '騎手分析', '入門ガイド', '馬券・統計'].includes(category);
}

function reserveSlot<T extends ArticleOrderItem>(
  items: T[],
  predicate: (order: any) => boolean,
  targetIndex: number,
  maxArticles: number,
  label: string,
): T[] {
  if (targetIndex < 0 || targetIndex >= maxArticles) return items;
  if (items.slice(0, maxArticles).some(item => predicate(item.order))) return items;

  const foundIndex = items.findIndex(
    (item, index) => index >= maxArticles && predicate(item.order),
  );
  if (foundIndex < 0) return items;

  const result = [...items];
  const [reservedItem] = result.splice(foundIndex, 1);
  result.splice(targetIndex, 0, reservedItem);
  console.log(`[Pipeline] ${label}枠を予約: ${reservedItem.file} を今回の処理枠に移動`);
  return result;
}

export function prioritizeOrderFiles<T extends ArticleOrderItem>(
  items: T[],
  options: ArticleOrderPriorityOptions,
): T[] {
  const maxArticles = Math.max(1, options.maxArticles);
  let result = [...items];
  const urgentItems = result.filter(item => isUrgentGradeRaceOrder(item.order));

  // 公開期限に達した重賞と検索急落救済は、件数が枠未満でも必ず先に処理する。
  // これにより通常記事の高いpriorityや常設予約枠がD-10/D-7更新を押し出さない。
  if (options.aggressiveCoverage !== false && urgentItems.length > 0) {
    const selected = urgentItems.slice(0, maxArticles);
    const selectedFiles = new Set(selected.map(item => item.file));
    const remaining = result.filter(item => !selectedFiles.has(item.file));
    let reservedEvergreen: T | undefined;
    if (
      options.reserveEvergreenSlot
      && selected.length === 1
      && maxArticles >= 3
    ) {
      reservedEvergreen = remaining.find(item => isEvergreenOrder(item.order));
    }

    const fillLimit = maxArticles - selected.length - (reservedEvergreen ? 1 : 0);
    const fillers = remaining
      .filter(item => item.file !== reservedEvergreen?.file)
      .slice(0, Math.max(0, fillLimit));
    const leading = [...selected, ...fillers, ...(reservedEvergreen ? [reservedEvergreen] : [])];
    const leadingFiles = new Set(leading.map(item => item.file));
    return [...leading, ...result.filter(item => !leadingFiles.has(item.file))];
  }

  if (options.reserveRaceUpdateSlot && maxArticles >= 2) {
    const targetIndex = maxArticles >= 3 ? maxArticles - 2 : maxArticles - 1;
    result = reserveSlot(
      result,
      isRaceUpdateOrder,
      targetIndex,
      maxArticles,
      'レース更新',
    );
  }

  if (
    options.reserveEvergreenSlot
    && maxArticles >= 3
    && urgentItems.length < maxArticles - 1
  ) {
    result = reserveSlot(
      result,
      isEvergreenOrder,
      maxArticles - 1,
      maxArticles,
      '常設コラム',
    );
  }
  return result;
}
