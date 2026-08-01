export type ArticleOrderItem = {
  file: string;
  order: any;
  priority: number;
};

export type ArticleOrderPriorityOptions = {
  maxArticles: number;
  reserveRaceUpdateSlot: boolean;
  reserveEvergreenSlot: boolean;
};

export function isRaceUpdateOrder(order: any): boolean {
  const cluster = String(order?.theme_cluster || order?.reference_data?.article_type || '');
  return cluster === 'race_update';
}

export function isUrgentGradeRaceOrder(order: any): boolean {
  const ref = order?.reference_data || {};
  const entityType = String(order?.entity_type || ref.entity_type || '');
  const cluster = String(order?.theme_cluster || ref.article_type || '');
  const deadlineStatus = String(ref.deadline_status || '');
  const updateStage = String(ref.update_stage || '');
  return (
    entityType === 'grade_race'
    && (cluster === 'race_update' || cluster === 'grade_race_preview')
    && (
      deadlineStatus === 'due_preview'
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

  // 緊急重賞が枠数以上ある場合は、通常記事のpriorityにかかわらず全枠を重賞へ渡す。
  if (urgentItems.length >= maxArticles) {
    const urgentFiles = new Set(urgentItems.map(item => item.file));
    return [
      ...urgentItems,
      ...result.filter(item => !urgentFiles.has(item.file)),
    ];
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
