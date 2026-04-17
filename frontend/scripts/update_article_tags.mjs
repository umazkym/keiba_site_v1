import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const articlesDir = path.join(process.cwd(), 'content', 'articles');

function determineCategoryAndTags(filename, currentCategory) {
  // Default fallback
  let newCat = "血統・馬券コラム";
  let tags = [];

  const name = filename.toLowerCase();

  // 1. 初心者ガイド
  if (currentCategory === "初心者向けガイド" || currentCategory === "初心者ガイド" || name.includes("guide") || name.includes("manual") || name.includes("impact") || name.includes("explanation") || name.includes("terms")) {
    return { category: "初心者向けガイド", tags: [] };
  }

  // 2. 騎手データ分析 (NEW TIER 1)
  if (currentCategory === "騎手分析" || name.includes("jockey") || name.includes("lemaire") || name.includes("take") || name.includes("miura") || name.includes("kawada") || name.includes("ishikawa") || name.includes("tosakikeita") || name.includes("tosaki") || name.includes("yokoyama") || name.includes("sakai") || name.includes("matsuyama")) {
    newCat = "騎手データ分析";
    
    if (name.includes("lemaire")) tags.push("C.ルメール");
    if (name.includes("take") && !name.includes("ticket")) tags.push("武豊");
    if (name.includes("miura")) tags.push("三浦皇成");
    if (name.includes("kawada")) tags.push("川田将雅");
    if (name.includes("ishikawa")) tags.push("石川裕紀人");
    if (name.includes("tosakikeita") || name.includes("tosaki")) tags.push("戸崎圭太");
    if (name.includes("yokoyama")) tags.push("横山武史");
    if (name.includes("sakai")) tags.push("坂井瑠星");
    if (name.includes("matsuyama")) tags.push("松山弘平");
    return { category: newCat, tags };
  }

  // 3. 重賞データ攻略
  if (currentCategory === "重賞予想・分析" || currentCategory === "重賞分析" || name.includes("stakes") || name.includes("cup") || name.includes("kinen") || name.includes("championship")) {
    newCat = "重賞データ攻略";
    if (name.includes("arima-kinen") || name.includes("japan-cup") || name.includes("tennosho-autumn") || name.includes("mile-championship") || name.includes("elizabeth-queen-cup") || name.includes("chrysanthemum-stakes") || name.includes("february-stakes")) {
      tags.push("G1");
    } else if (name.includes("artemis-stakes")) {
      tags.push("G3");
    } else {
      tags.push("重賞");
    }
    return { category: newCat, tags };
  }

  // 4. コース・枠順分析
  if (currentCategory === "競馬場・コースデータ" || currentCategory === "course-data" || currentCategory === "枠順データ" || currentCategory === "コース分析" || name.includes("turf") || name.includes("dirt") || name.includes("waku")) {
    newCat = "コース・枠順分析";
    
    // 競馬場のみ（距離は廃止）
    const racecourses = [];
    if (name.includes("tokyo")) racecourses.push("東京");
    if (name.includes("nakayama")) racecourses.push("中山");
    if (name.includes("kyoto")) racecourses.push("京都");
    if (name.includes("hanshin")) racecourses.push("阪神");
    if (name.includes("chukyo")) racecourses.push("中京");
    if (name.includes("fukushima") || name.includes("niigata") || name.includes("kokura") || name.includes("sapporo")) {
      racecourses.push("ローカル"); // まとめちゃう手もあるが、個別に出す？
      if (name.includes("fukushima")) racecourses.push("福島");
      if (name.includes("niigata")) racecourses.push("新潟");
      if (name.includes("kokura")) racecourses.push("小倉");
      if (name.includes("sapporo")) racecourses.push("札幌");
    }

    // 重複除去しつつ登録
    [...new Set(racecourses)].forEach(r => tags.push(r));

    // 枠順タグは残す
    if (name.includes("waku") || currentCategory === "枠順データ") tags.push("枠順");

    return { category: newCat, tags };
  }

  // 5. 血統・馬券コラム
  newCat = "血統・馬券コラム";
  if (name.includes("bloodline")) {
    tags.push("血統");
  } else {
    tags.push("馬券術");
  }

  return { category: newCat, tags };
}

async function run() {
  const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
  
  let updatedCount = 0;
  for (const file of files) {
    const fullPath = path.join(articlesDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Parse front matter
    const parsed = matter(content);
    const data = parsed.data;
    
    let currentCat = data.category || "";
    if (typeof currentCat === 'string') currentCat = currentCat.replace(/^"|"$/g, '');

    const { category, tags } = determineCategoryAndTags(file, currentCat);

    // Update data
    data.category = category;
    data.tags = tags;

    // Stringify back to markdown
    const updatedContent = matter.stringify(parsed.content, data);
    
    fs.writeFileSync(fullPath, updatedContent);
    console.log(`Updated [${file}] -> Cat: ${category}, Tags: ${tags.join(',')}`);
    updatedCount++;
  }
  
  console.log(`Successfully updated ${updatedCount} files.`);
}

run();
