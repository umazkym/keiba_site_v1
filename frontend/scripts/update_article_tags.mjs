import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const articlesDir = path.join(process.cwd(), 'content', 'articles');

function determineCategoryAndTags(filename, currentCategory) {
  let newCat = "データ分析・コラム";
  let tags = [];

  const name = filename.toLowerCase();

  // 1. 初心者ガイド
  if (currentCategory === "初心者向けガイド" || name.includes("guide") || name.includes("manual")) {
    return { category: "初心者ガイド", tags: [] };
  }

  // 2. 重賞予想・分析
  if (currentCategory === "重賞分析" || name.includes("stakes") || name.includes("cup") || name.includes("kinen") || name.includes("championship")) {
    newCat = "重賞予想・分析";
    tags.push("重賞");
    if (name.includes("arima-kinen")) tags.push("有馬記念", "G1");
    if (name.includes("japan-cup")) tags.push("ジャパンカップ", "G1");
    if (name.includes("tennosho-autumn")) tags.push("天皇賞(秋)", "G1");
    if (name.includes("mile-championship")) tags.push("マイルCS", "G1");
    if (name.includes("elizabeth-queen-cup")) tags.push("エリザベス女王杯", "G1");
    if (name.includes("chrysanthemum-stakes")) tags.push("菊花賞", "G1");
    if (name.includes("february-stakes")) tags.push("フェブラリーS", "G1");
    if (name.includes("artemis-stakes")) tags.push("アルテミスS", "G3");
    return { category: newCat, tags };
  }

  // 3. 競馬場・コースデータ
  if (currentCategory === "course-data" || currentCategory === "枠順データ" || currentCategory === "コース分析" || name.includes("turf") || name.includes("dirt") || name.includes("waku")) {
    newCat = "競馬場・コースデータ";
    
    // 競馬場
    if (name.includes("tokyo")) tags.push("東京");
    if (name.includes("nakayama")) tags.push("中山");
    if (name.includes("kyoto")) tags.push("京都");
    if (name.includes("hanshin")) tags.push("阪神");
    if (name.includes("chukyo")) tags.push("中京");
    if (name.includes("fukushima")) tags.push("福島");
    if (name.includes("niigata")) tags.push("新潟");
    if (name.includes("kokura")) tags.push("小倉");
    if (name.includes("sapporo")) tags.push("札幌");
    
    // 距離
    const distMatch = name.match(/(\d{4})m/);
    if (distMatch) tags.push(`${name.includes("turf") ? "芝" : "ダート"}${distMatch[1]}m`);

    // 枠順など
    if (name.includes("waku") || currentCategory === "枠順データ") tags.push("枠順");

    return { category: newCat, tags };
  }

  // 4. データ分析・コラム (騎手、血統など)
  if (currentCategory === "騎手分析" || name.includes("jockey")) {
    newCat = "データ分析・コラム";
    tags.push("騎手");
    if (name.includes("lemaire")) tags.push("C.ルメール");
    if (name.includes("take")) tags.push("武豊");
    if (name.includes("miura")) tags.push("三浦皇成");
    if (name.includes("kawada")) tags.push("川田将雅");
    if (name.includes("ishikawa")) tags.push("石川裕紀人");
    if (name.includes("tosakikeita") || name.includes("tosaki")) tags.push("戸崎圭太");
    if (name.includes("yokoyama")) tags.push("横山武史");
    if (name.includes("sakai")) tags.push("坂井瑠星");
    if (name.includes("matsuyama")) tags.push("松山弘平");
  } else if (name.includes("bloodline")) {
    tags.push("血統");
  } else {
    // Other generalized data analysis
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
    // remove quotes
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
