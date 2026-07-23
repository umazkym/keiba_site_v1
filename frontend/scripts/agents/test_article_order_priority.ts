import assert from 'assert';
import {
  isUrgentGradeRaceOrder,
  prioritizeOrderFiles,
  type ArticleOrderItem,
} from './article_order_priority';

function urgent(file: string, priority: number): ArticleOrderItem {
  return {
    file,
    priority,
    order: {
      entity_type: 'grade_race',
      theme_cluster: 'race_update',
      reference_data: {
        deadline_status: 'due_preview',
        update_stage: 'draw_confirmed',
      },
    },
  };
}

const items: ArticleOrderItem[] = [
  {
    file: 'general-high-priority.json',
    priority: 999,
    order: { theme_cluster: 'data_analysis' },
  },
  urgent('grade-one.json', 100),
  urgent('grade-two.json', 90),
  urgent('grade-three.json', 80),
  {
    file: 'evergreen.json',
    priority: 70,
    order: { theme_cluster: 'jockey_profile' },
  },
];

const prioritized = prioritizeOrderFiles(items, {
  maxArticles: 3,
  reserveRaceUpdateSlot: true,
  reserveEvergreenSlot: true,
});
assert.equal(prioritized.slice(0, 3).every(item => isUrgentGradeRaceOrder(item.order)), true);
assert.deepEqual(
  prioritized.slice(0, 3).map(item => item.file),
  ['grade-one.json', 'grade-two.json', 'grade-three.json'],
);

const noGscInput = prioritizeOrderFiles(items, {
  maxArticles: 3,
  reserveRaceUpdateSlot: true,
  reserveEvergreenSlot: true,
});
assert.deepEqual(
  noGscInput.slice(0, 3).map(item => item.file),
  ['grade-one.json', 'grade-two.json', 'grade-three.json'],
);

console.log('Article order priority tests passed.');
