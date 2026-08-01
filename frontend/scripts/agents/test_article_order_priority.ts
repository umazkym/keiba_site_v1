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

const dueInitialItems: ArticleOrderItem[] = [
  {
    file: 'general-priority.json',
    priority: 999,
    order: { theme_cluster: 'data_analysis' },
  },
  ...['a', 'b'].map((name, index) => ({
    file: `due-${name}.json`,
    priority: 90 - index,
    order: {
      entity_type: 'grade_race',
      theme_cluster: 'race_update',
      reference_data: { deadline_status: index === 0 ? 'due_initial' : 'due_race_week' },
    },
  })),
  {
    file: 'evergreen-lower.json',
    priority: 70,
    order: { theme_cluster: 'jockey_profile' },
  },
];
const dueInitialPrioritized = prioritizeOrderFiles(dueInitialItems, {
  maxArticles: 3,
  reserveRaceUpdateSlot: true,
  reserveEvergreenSlot: true,
  aggressiveCoverage: true,
});
assert.deepEqual(
  dueInitialPrioritized.slice(0, 2).map(item => item.file),
  ['due-a.json', 'due-b.json'],
);

const repairItems: ArticleOrderItem[] = [
  {
    file: 'general.json',
    priority: 999,
    order: { theme_cluster: 'data_analysis' },
  },
  {
    file: 'repair.json',
    priority: 130,
    order: {
      operation: 'grade_race_search_repair',
      theme_cluster: 'grade_race_search_repair',
    },
  },
];
const repairPrioritized = prioritizeOrderFiles(repairItems, {
  maxArticles: 1,
  reserveRaceUpdateSlot: true,
  reserveEvergreenSlot: true,
  aggressiveCoverage: true,
});
assert.equal(repairPrioritized[0].file, 'repair.json');

console.log('Article order priority tests passed.');
