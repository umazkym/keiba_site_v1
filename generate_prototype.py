#!/usr/bin/env python3
"""UMA-FREE プロトタイプHTML生成スクリプト v2
レース分析を別ページ化し、トップにAI注目馬・的中ランキング・記事を配置
"""
import os

OUTPUT = os.path.join(os.path.dirname(__file__), "uma-free-prototype.html")

CSS = """
:root {
  --primary:#0f172a;--primary-light:#1e293b;--primary-dark:#020617;
  --secondary:#64748b;--secondary-light:#94a3b8;
  --accent:#f59e0b;--accent-light:#fbbf24;
  --bg:#f8fafc;--surface:#fff;--border:#e2e8f0;--text:#0f172a;
  --muted:#94a3b8;--gap:0.75rem;
}
@media(min-width:640px){:root{--gap:1.25rem;}}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased;}
body{font-family:'Inter','Noto Sans JP',sans-serif;background:var(--bg);color:var(--text);line-height:1.6;min-height:100vh;padding-bottom:70px;}
a{color:inherit;text-decoration:none;transition:color .2s;}
img{max-width:100%;height:auto;}
.header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.85);backdrop-filter:blur(12px);border-bottom:1px solid rgba(226,232,240,.5);}
.header-inner{max-width:1200px;margin:0 auto;padding:0 12px;display:flex;align-items:center;justify-content:space-between;height:52px;}
@media(min-width:640px){.header-inner{height:56px;padding:0 16px;}}
.logo{display:flex;align-items:center;gap:8px;font-weight:800;font-size:1.15rem;color:var(--primary);}
.logo-sub{font-size:.65rem;color:var(--muted);font-weight:500;letter-spacing:.05em;}
.nav-desktop{display:none;align-items:center;gap:24px;margin-left:32px;}
@media(min-width:768px){.nav-desktop{display:flex;}}
.nav-desktop a{font-size:.8rem;font-weight:600;color:var(--secondary);transition:color .2s;}
.nav-desktop a:hover{color:var(--primary);}
.menu-btn{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:none;background:transparent;cursor:pointer;border-radius:8px;color:var(--secondary);}
.menu-btn:hover{background:#f1f5f9;color:var(--primary);}
@media(min-width:768px){.menu-btn{display:none;}}
.mobile-overlay{position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:40;opacity:0;pointer-events:none;transition:opacity .3s;}
.mobile-overlay.active{opacity:1;pointer-events:auto;}
.mobile-menu{position:fixed;top:52px;left:0;right:0;background:#fff;z-index:45;transform:translateY(-110%);opacity:0;transition:transform .35s cubic-bezier(.16,1,.3,1),opacity .25s;box-shadow:0 8px 30px rgba(0,0,0,.1);max-height:calc(100dvh - 52px);overflow-y:auto;}
.mobile-menu.open{transform:translateY(0);opacity:1;}
.mobile-menu a{display:block;padding:12px 16px;font-size:.875rem;font-weight:500;color:var(--text);border-bottom:1px solid #f8fafc;transition:background .15s;}
.mobile-menu a:hover{background:#f8fafc;color:var(--primary);}
.main{max-width:960px;margin:0 auto;padding:12px;display:flex;flex-direction:column;gap:var(--gap);}
@media(min-width:640px){.main{padding:16px 20px;}}
.adsense-manual{display:flex;align-items:center;justify-content:center;background:#f9fafb;border:1px dashed #cbd5e1;border-radius:10px;color:var(--muted);font-size:.75rem;font-weight:600;letter-spacing:.08em;position:relative;overflow:hidden;}
.ad-header{min-height:50px;}
.ad-mid{min-height:90px;}
.ad-bottom{min-height:90px;}
.ad-sticky{position:fixed;bottom:0;left:0;right:0;z-index:48;min-height:50px;border-radius:0;border:none;border-top:1px solid var(--border);background:rgba(249,250,251,.97);backdrop-filter:blur(8px);box-shadow:0 -2px 10px rgba(0,0,0,.06);}
.ad-sticky .ad-close{position:absolute;top:-24px;right:4px;width:24px;height:24px;border:1px solid var(--border);border-bottom:none;background:rgba(255,255,255,.95);border-radius:6px 6px 0 0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--secondary);line-height:1;}
.hero{background:var(--primary);border-radius:16px;padding:28px 16px;text-align:center;position:relative;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.15);}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at top,rgba(59,130,246,.15),transparent 60%);}
.hero *{position:relative;z-index:1;}
.hero h1{font-size:1.4rem;font-weight:800;color:#fff;line-height:1.3;margin-bottom:6px;}
.hero h1 span{background:linear-gradient(90deg,#bfdbfe,#c7d2fe);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.hero p{font-size:.78rem;color:#94a3b8;max-width:500px;margin:0 auto 14px;line-height:1.7;}
.hero-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:16px;color:rgba(255,255,255,.85);}
.hero-stats .num{font-size:1.15rem;font-weight:700;color:#fff;}
.hero-stats .lbl{font-size:.62rem;color:#94a3b8;letter-spacing:.05em;}
.hero-btn{display:inline-flex;align-items:center;background:#fff;color:var(--primary);font-weight:700;padding:10px 24px;border-radius:12px;font-size:.82rem;box-shadow:0 4px 14px rgba(255,255,255,.15);transition:all .2s;}
.hero-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(255,255,255,.2);}
@media(min-width:640px){.hero{padding:40px 24px;border-radius:20px;}.hero h1{font-size:2rem;}.hero p{font-size:.88rem;}.hero-stats .num{font-size:1.4rem;}}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:all .2s;}
.card:hover{box-shadow:0 4px 20px rgba(15,23,42,.06);}
.card-body{padding:14px;}
@media(min-width:640px){.card{border-radius:14px;}.card-body{padding:20px;}}
.sec-title{font-size:1rem;font-weight:700;color:var(--primary);display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.sec-title .bar{width:3px;height:20px;border-radius:2px;flex-shrink:0;}
@media(min-width:640px){.sec-title{font-size:1.15rem;}}
.accordion{border-radius:12px;overflow:hidden;}
.accordion summary{list-style:none;cursor:pointer;padding:12px 14px;font-size:.85rem;font-weight:700;color:var(--text);display:flex;align-items:center;justify-content:space-between;transition:background .15s;user-select:none;}
.accordion summary:hover{background:#f8fafc;}
.accordion summary::-webkit-details-marker{display:none;}
.accordion summary .chevron{transition:transform .3s;font-size:.7rem;color:var(--muted);}
.accordion[open] summary .chevron{transform:rotate(90deg);}
.accordion .acc-body{padding:0 14px 14px;font-size:.82rem;color:var(--secondary);line-height:1.8;}
@media(min-width:640px){.accordion summary{padding:14px 20px;font-size:.9rem;}.accordion .acc-body{padding:0 20px 20px;font-size:.85rem;}}
.features{display:grid;grid-template-columns:1fr;gap:10px;}
@media(min-width:768px){.features{grid-template-columns:repeat(3,1fr);gap:14px;}}
.feat{padding:16px;display:flex;gap:12px;align-items:flex-start;}
@media(min-width:768px){.feat{flex-direction:column;align-items:center;text-align:center;padding:20px;}}
.feat-icon{width:44px;height:44px;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--primary);border:1px solid #e2e8f0;}
.feat h3{font-size:.82rem;font-weight:700;color:var(--primary);margin-bottom:4px;}
.feat p{font-size:.72rem;color:var(--secondary);line-height:1.7;}
.steps{display:grid;grid-template-columns:1fr;gap:8px;}
@media(min-width:768px){.steps{grid-template-columns:repeat(3,1fr);gap:12px;}}
.step{padding:14px;display:flex;align-items:flex-start;gap:10px;}
.step-num{width:32px;height:32px;background:var(--primary);color:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.82rem;flex-shrink:0;}
.step h3{font-size:.82rem;font-weight:700;color:var(--primary);margin-bottom:2px;}
.step p{font-size:.72rem;color:var(--secondary);line-height:1.7;}
.faq-item{border-left:3px solid rgba(148,163,184,.3);padding:8px 0 8px 14px;}
.faq-item h4{font-size:.82rem;font-weight:700;margin-bottom:4px;}
.faq-item p{font-size:.75rem;color:var(--secondary);line-height:1.7;}
.badges{display:flex;flex-wrap:wrap;gap:6px;}
.badge{font-size:.72rem;font-weight:600;color:var(--secondary);background:#fff;border:1px solid var(--border);padding:4px 10px;border-radius:6px;}
.footer{background:var(--primary);color:#94a3b8;padding:32px 16px;margin-bottom:60px;}
.footer-inner{max-width:1200px;margin:0 auto;}
.footer-grid{display:grid;grid-template-columns:1fr;gap:24px;margin-bottom:24px;}
@media(min-width:640px){.footer-grid{grid-template-columns:repeat(3,1fr);gap:32px;}.footer{padding:48px 24px;}}
.footer h3{color:#fff;font-weight:700;font-size:.85rem;margin-bottom:10px;}
.footer a{display:block;font-size:.75rem;color:#94a3b8;padding:3px 0;transition:color .2s;}
.footer a:hover{color:#fff;}
.footer-bottom{border-top:1px solid #1e293b;padding-top:20px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;font-size:.72rem;color:#64748b;}
/* PICK CARD */
.pick-card{position:relative;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff;transition:all .2s;}
.pick-card:hover{box-shadow:0 4px 20px rgba(15,23,42,.08);}
.pick-card .glow{position:absolute;top:0;right:0;width:120px;height:120px;background:radial-gradient(circle,rgba(59,130,246,.06),transparent 70%);pointer-events:none;}
.pick-inner{padding:12px 14px;position:relative;z-index:1;}
.pick-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.pick-badge{font-size:.6rem;font-weight:700;background:var(--primary);color:#fff;padding:3px 7px;border-radius:4px;line-height:1;}
.pick-score{font-size:.65rem;font-weight:700;color:#1d4ed8;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.15);padding:3px 8px;border-radius:12px;display:flex;align-items:center;gap:4px;}
.pick-score .val{font-size:.85rem;font-family:'Inter',monospace;letter-spacing:-.02em;}
.pick-name{font-size:1.15rem;font-weight:800;color:var(--primary-dark);line-height:1.2;margin-bottom:4px;}
.pick-meta{font-size:.65rem;color:var(--secondary);background:#f8fafc;border:1px solid #f1f5f9;padding:3px 7px;border-radius:4px;display:inline-block;margin-bottom:6px;}
.pick-comment{font-size:.72rem;color:var(--primary-light);line-height:1.5;border-top:1px solid #f1f5f9;padding-top:6px;}
@media(min-width:640px){.pick-inner{padding:16px 20px;}.pick-name{font-size:1.5rem;}.pick-badge{font-size:.72rem;}.pick-score{font-size:.72rem;}.pick-score .val{font-size:1rem;}}
/* HITS */
.hits-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;}
@media(min-width:1024px){.hits-grid{grid-template-columns:repeat(5,1fr);gap:10px;}}
.hit-card{background:#fff;border:1px solid var(--border);border-radius:10px;padding:8px 10px;transition:all .2s;}
.hit-card:hover{box-shadow:0 2px 12px rgba(15,23,42,.06);}
.hit-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;}
.hit-rank{font-size:.6rem;font-weight:700;padding:2px 6px;border-radius:4px;line-height:1;}
.rank-1{background:#fef3c7;color:#92400e;border:1px solid #fde68a;}
.rank-2{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;}
.rank-3{background:#ffedd5;color:#9a3412;border:1px solid #fed7aa;}
.rank-default{background:#f8fafc;color:#64748b;border:1px solid #f1f5f9;}
.hit-payout{font-size:.85rem;font-weight:700;color:#dc2626;letter-spacing:-.02em;}
.hit-info{font-size:.6rem;color:var(--muted);margin-bottom:2px;}
.hit-name{font-size:.72rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;}
.hit-bet{font-size:.6rem;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
/* ARTICLES */
.articles-list{display:flex;flex-direction:column;gap:10px;}
@media(min-width:640px){.articles-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}.articles-list{display:none;}}
.article-card{display:flex;align-items:center;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff;transition:all .2s;}
.article-card:hover{box-shadow:0 4px 16px rgba(15,23,42,.06);}
.article-thumb{width:88px;height:66px;background:#e2e8f0;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.6rem;color:var(--muted);overflow:hidden;position:relative;}
.article-thumb img{width:100%;height:100%;object-fit:cover;}
.article-body{padding:8px 10px;min-width:0;flex:1;}
.article-cat{font-size:.62rem;font-weight:600;background:#f1f5f9;color:#475569;padding:2px 6px;border-radius:10px;display:inline-block;margin-bottom:3px;}
.article-title{font-size:.78rem;font-weight:700;color:var(--text);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.article-date{font-size:.6rem;color:var(--muted);margin-top:2px;}
/* GRID ARTICLE FOR DESKTOP */
.article-card-v{display:none;flex-direction:column;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff;transition:all .2s;}
@media(min-width:640px){.article-card-v{display:flex;}.articles-list .article-card{display:none;}}
.article-card-v:hover{box-shadow:0 4px 16px rgba(15,23,42,.06);}
.article-thumb-v{width:100%;height:140px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:.65rem;color:var(--muted);overflow:hidden;position:relative;}
@media(min-width:768px){.article-thumb-v{height:160px;}}
.article-thumb-v img{width:100%;height:100%;object-fit:cover;}
.article-body-v{padding:12px 14px;}
.article-body-v .article-title{font-size:.85rem;}
/* CTA BANNER */
.cta-banner{background:linear-gradient(135deg,var(--primary) 0%,#1e3a5f 100%);border-radius:14px;padding:20px 16px;text-align:center;position:relative;overflow:hidden;}
.cta-banner::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at bottom right,rgba(245,158,11,.12),transparent 60%);}
.cta-banner *{position:relative;z-index:1;}
.cta-banner h2{font-size:1.05rem;font-weight:800;color:#fff;margin-bottom:6px;}
.cta-banner p{font-size:.75rem;color:#94a3b8;margin-bottom:14px;}
.cta-btn{display:inline-flex;align-items:center;gap:6px;background:var(--accent);color:#fff;font-weight:700;padding:10px 22px;border-radius:10px;font-size:.82rem;box-shadow:0 4px 14px rgba(245,158,11,.25);transition:all .2s;}
.cta-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(245,158,11,.3);background:var(--accent-light);}
@media(min-width:640px){.cta-banner{padding:28px 24px;}.cta-banner h2{font-size:1.3rem;}}
.disclaimer{background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;font-size:.72rem;color:#92400e;line-height:1.6;}
"""

HTML_BODY = """<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5">
<title>UMA-FREE | AI競馬データ分析・統計情報サイト</title>
<meta name="description" content="競馬レースの統計分析データを完全無料で提供。過去5年以上のデータを機械学習で分析。">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
""" + CSS + """
</style>
</head>
<body>

<!-- HEADER -->
<header class="header">
<div class="header-inner">
  <a href="#" class="logo">
    <div style="width:36px;height:36px;background:var(--primary);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.7rem;font-weight:800;">UF</div>
    <div><div style="font-size:1.1rem;">UMA-FREE</div><div class="logo-sub">完全無料のAI競馬分析</div></div>
  </a>
  <nav class="nav-desktop">
    <a href="#">ホーム</a><a href="#">本日の分析</a><a href="#">記事</a><a href="#">よくある質問</a><a href="#">AIモデル</a>
  </nav>
  <button class="menu-btn" id="menuBtn" aria-label="メニュー">
    <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
  </button>
</div>
</header>
<div class="mobile-overlay" id="overlay"></div>
<nav class="mobile-menu" id="mobileMenu">
  <a href="#">ホーム</a><a href="#">本日の分析</a><a href="#">記事</a><a href="#">よくある質問</a><a href="#">AIモデル</a><a href="#">検索</a>
  <div style="padding:12px 16px;background:#f8fafc;border-top:1px solid #f1f5f9;">
    <div style="font-size:.65rem;color:var(--muted);font-weight:700;letter-spacing:.1em;margin-bottom:6px;">その他</div>
    <a href="#" style="font-size:.8rem;">このサイトについて</a><a href="#" style="font-size:.8rem;">広告について</a><a href="#" style="font-size:.8rem;">お問い合わせ</a><a href="#" style="font-size:.8rem;">プライバシーポリシー</a>
  </div>
</nav>

<main class="main">
  <!-- AD①: ヘッダー直下バナー -->
  <div class="adsense-manual ad-header">広告枠（ヘッダー直下バナー）</div>

  <!-- HERO -->
  <section class="hero">
    <h1>登録不要・完全無料<br><span>AI競馬データ分析</span></h1>
    <p>過去5年以上のレースデータを統計的に分析。中央・地方の全レースに対応。</p>
    <div class="hero-stats">
      <div><div class="num">24</div><div class="lbl">対応競馬場</div></div>
      <div><div class="num">5年+</div><div class="lbl">分析データ</div></div>
      <div><div class="num">48</div><div class="lbl">分析記事</div></div>
      <div><div class="num">毎日</div><div class="lbl">データ更新</div></div>
    </div>
    <a href="#" class="hero-btn">今日のデータ分析をチェック →</a>
  </section>

  <!-- 今日の分析注目馬 + 高配当的中ランキング（2カラム on desktop） -->
  <div style="display:grid;gap:var(--gap);">

    <!-- AI注目馬セクション -->
    <section>
      <h2 class="sec-title"><span class="bar" style="background:var(--accent);"></span>今日の分析注目馬</h2>
      <div class="pick-card">
        <div class="glow"></div>
        <div class="pick-inner">
          <div class="pick-top">
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="pick-badge">AI注目馬</span>
              <span style="font-size:.6rem;color:var(--muted);">2026年3月18日</span>
            </div>
            <span class="pick-score">偏差値 <span class="val">72.45</span></span>
          </div>
          <p class="pick-name">サンプルディープ</p>
          <span class="pick-meta">東京 11R ・ 春嵐ステークス</span>
          <p class="pick-comment">AI偏差値 72.45。東京11R の サンプルディープ を詳しく見る →</p>
        </div>
      </div>
    </section>

    <!-- 高配当的中ランキング -->
    <section>
      <h2 class="sec-title">
        <svg width="18" height="18" fill="none" stroke="#eab308" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>
        高配当的中ランキング
        <span style="font-size:.65rem;font-weight:400;color:var(--muted);margin-left:4px;">(直近7日)</span>
      </h2>
      <div class="hits-grid">
        <a href="#" class="hit-card" style="border-color:#fde68a;">
          <div class="hit-top"><span class="hit-rank rank-1">1位</span><span class="hit-payout">128,450円</span></div>
          <div class="hit-info">3/16 東京11R</div>
          <div class="hit-name">春嵐ステークス</div>
          <div class="hit-bet">三連複: 3-7-12</div>
        </a>
        <a href="#" class="hit-card">
          <div class="hit-top"><span class="hit-rank rank-2">2位</span><span class="hit-payout">84,320円</span></div>
          <div class="hit-info">3/15 中山9R</div>
          <div class="hit-name">弥生賞ディープ記念</div>
          <div class="hit-bet">三連複: 1-5-8</div>
        </a>
        <a href="#" class="hit-card">
          <div class="hit-top"><span class="hit-rank rank-3">3位</span><span class="hit-payout">52,100円</span></div>
          <div class="hit-info">3/16 阪神12R</div>
          <div class="hit-name">播磨特別</div>
          <div class="hit-bet">馬連: 4-11</div>
        </a>
        <a href="#" class="hit-card">
          <div class="hit-top"><span class="hit-rank rank-default">4位</span><span class="hit-payout">31,800円</span></div>
          <div class="hit-info">3/14 大井8R</div>
          <div class="hit-name">東京スプリント</div>
          <div class="hit-bet">三連複: 2-6-9</div>
        </a>
        <a href="#" class="hit-card">
          <div class="hit-top"><span class="hit-rank rank-default">5位</span><span class="hit-payout">24,650円</span></div>
          <div class="hit-info">3/15 東京7R</div>
          <div class="hit-name">4歳上1勝クラス</div>
          <div class="hit-bet">ワイド: 3-10</div>
        </a>
      </div>
    </section>
  </div>

  <!-- AD②: コンテンツ中盤 -->
  <div class="adsense-manual ad-mid">広告枠（記事内広告）</div>

  <!-- CTA: レース分析ページへ誘導 -->
  <section class="cta-banner">
    <h2>📊 今日のレース分析を見る</h2>
    <p>AI偏差値・対戦成績・枠順傾向で全レースを徹底分析</p>
    <a href="#" class="cta-btn">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
      レース分析ページへ
    </a>
  </section>

  <!-- 最新の分析記事 -->
  <section>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
      <h2 class="sec-title" style="margin-bottom:0;"><span class="bar" style="background:var(--secondary);"></span>最新の分析記事</h2>
      <a href="#" style="font-size:.72rem;font-weight:600;color:var(--secondary);">すべて見る →</a>
    </div>

    <!-- モバイル: 横並びリスト / デスクトップ: グリッド -->
    <div class="articles-list">
      <a href="#" class="article-card">
        <div class="article-thumb"><div style="width:100%;height:100%;background:linear-gradient(135deg,#dbeafe,#e0e7ff);display:flex;align-items:center;justify-content:center;font-size:.7rem;color:#6366f1;font-weight:600;">📊</div></div>
        <div class="article-body">
          <span class="article-cat">データ分析</span>
          <p class="article-title">AI偏差値の精度検証：2026年1-3月の回収率レポート</p>
          <span class="article-date">2026/03/16</span>
        </div>
      </a>
      <a href="#" class="article-card">
        <div class="article-thumb"><div style="width:100%;height:100%;background:linear-gradient(135deg,#dcfce7,#d1fae5);display:flex;align-items:center;justify-content:center;font-size:.7rem;color:#059669;font-weight:600;">🏇</div></div>
        <div class="article-body">
          <span class="article-cat">レース分析</span>
          <p class="article-title">春のG1シーズン展望：大阪杯の注目データを読み解く</p>
          <span class="article-date">2026/03/14</span>
        </div>
      </a>
      <a href="#" class="article-card">
        <div class="article-thumb"><div style="width:100%;height:100%;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;font-size:.7rem;color:#d97706;font-weight:600;">📈</div></div>
        <div class="article-body">
          <span class="article-cat">枠順分析</span>
          <p class="article-title">東京芝2000m 枠順別成績の統計的傾向まとめ</p>
          <span class="article-date">2026/03/12</span>
        </div>
      </a>
      <a href="#" class="article-card">
        <div class="article-thumb"><div style="width:100%;height:100%;background:linear-gradient(135deg,#fee2e2,#fecaca);display:flex;align-items:center;justify-content:center;font-size:.7rem;color:#dc2626;font-weight:600;">🎯</div></div>
        <div class="article-body">
          <span class="article-cat">的中レポート</span>
          <p class="article-title">先週の高配当的中のAI分析ポイントを振り返る</p>
          <span class="article-date">2026/03/11</span>
        </div>
      </a>
      <a href="#" class="article-card">
        <div class="article-thumb"><div style="width:100%;height:100%;background:linear-gradient(135deg,#f3e8ff,#e9d5ff);display:flex;align-items:center;justify-content:center;font-size:.7rem;color:#7c3aed;font-weight:600;">💡</div></div>
        <div class="article-body">
          <span class="article-cat">使い方</span>
          <p class="article-title">UMA-FREEのAI偏差値を活用した馬券検討ガイド</p>
          <span class="article-date">2026/03/09</span>
        </div>
      </a>
    </div>

    <!-- デスクトップ用 グリッドカード -->
    <div class="articles-grid" style="display:none;">
      <a href="#" class="article-card-v" style="display:flex;">
        <div class="article-thumb-v"><div style="width:100%;height:100%;background:linear-gradient(135deg,#dbeafe,#e0e7ff);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">📊</div></div>
        <div class="article-body-v"><span class="article-cat">データ分析</span><p class="article-title">AI偏差値の精度検証：2026年1-3月の回収率レポート</p><span class="article-date">2026/03/16</span></div>
      </a>
      <a href="#" class="article-card-v" style="display:flex;">
        <div class="article-thumb-v"><div style="width:100%;height:100%;background:linear-gradient(135deg,#dcfce7,#d1fae5);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🏇</div></div>
        <div class="article-body-v"><span class="article-cat">レース分析</span><p class="article-title">春のG1シーズン展望：大阪杯の注目データを読み解く</p><span class="article-date">2026/03/14</span></div>
      </a>
      <a href="#" class="article-card-v" style="display:flex;">
        <div class="article-thumb-v"><div style="width:100%;height:100%;background:linear-gradient(135deg,#fef3c7,#fde68a);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">📈</div></div>
        <div class="article-body-v"><span class="article-cat">枠順分析</span><p class="article-title">東京芝2000m 枠順別成績の統計的傾向まとめ</p><span class="article-date">2026/03/12</span></div>
      </a>
      <a href="#" class="article-card-v" style="display:flex;">
        <div class="article-thumb-v"><div style="width:100%;height:100%;background:linear-gradient(135deg,#fee2e2,#fecaca);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">🎯</div></div>
        <div class="article-body-v"><span class="article-cat">的中レポート</span><p class="article-title">先週の高配当的中のAI分析ポイントを振り返る</p><span class="article-date">2026/03/11</span></div>
      </a>
    </div>
  </section>

  <!-- UMA-FREEとは（アコーディオン） -->
  <details class="card accordion">
    <summary>UMA-FREEとは<span class="chevron">▶</span></summary>
    <div class="acc-body">
      <p>UMA-FREEは、過去5年以上の中央競馬（JRA）および地方競馬（NAR）の膨大なレースデータを機械学習アルゴリズムで分析し、各出走馬の能力を独自の<strong>AI偏差値</strong>として数値化した競馬データ分析サイトです。会員登録やメールアドレスの入力は一切不要で、すべての分析データを完全無料でご利用いただけます。</p>
      <p style="margin-top:10px;">さらに、出走馬同士の<strong>過去対決成績</strong>や、コース・距離ごとの<strong>枠順傾向スコア</strong>など、多角的なデータを組み合わせて提供。データは毎日自動更新されており、開催日の午前中には当日の全レース分析が完了します。</p>
    </div>
  </details>

  <!-- 3つの分析データ -->
  <section class="card">
    <div class="card-body">
      <h2 class="sec-title" style="justify-content:center;"><span class="bar" style="background:var(--primary);"></span>3つの分析データ</h2>
      <div class="features">
        <div class="card feat"><div class="feat-icon"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg></div><div><h3>完全無料・登録不要</h3><p>全24競馬場をカバー。登録なしで全データにアクセス。</p></div></div>
        <div class="card feat"><div class="feat-icon"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18 9l-5 5-2-2-4 4"/></svg></div><div><h3>AI偏差値分析</h3><p>5年以上の過去データを機械学習で解析。能力を偏差値で数値化。</p></div></div>
        <div class="card feat"><div class="feat-icon"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/></svg></div><div><h3>対戦成績・枠順分析</h3><p>直接対決の勝敗と枠順有利不利を統計スコアで表示。</p></div></div>
      </div>
    </div>
  </section>

  <!-- 3ステップ -->
  <section class="card">
    <div class="card-body">
      <h2 class="sec-title" style="justify-content:center;"><span class="bar" style="background:var(--accent);"></span>3ステップで始める</h2>
      <div class="steps">
        <div class="card step"><div class="step-num">1</div><div><h3>日付を選択</h3><p>カレンダーから見たい日付を選択。</p></div></div>
        <div class="card step"><div class="step-num">2</div><div><h3>競馬場を選択</h3><p>中央・地方のタブから対象の競馬場を選択。</p></div></div>
        <div class="card step"><div class="step-num">3</div><div><h3>データを活用</h3><p>偏差値・対決成績・枠順傾向をご活用ください。</p></div></div>
      </div>
    </div>
  </section>

  <!-- 免責事項 -->
  <div class="disclaimer">⚠ 本データは統計分析に基づく参考情報であり、的中を保証するものではありません。馬券購入は自己判断・自己責任でお願いします。</div>

  <!-- FAQ（アコーディオン） -->
  <details class="card accordion">
    <summary>よくある質問<span class="chevron">▶</span></summary>
    <div class="acc-body">
      <div style="display:grid;gap:12px;">
        <div class="faq-item"><h4>Q. 本当に無料ですか？</h4><p>はい。すべてのデータ分析情報が完全無料です。登録も不要です。</p></div>
        <div class="faq-item"><h4>Q. データはいつ更新されますか？</h4><p>毎日午前7時頃に前日の結果と翌日の分析データが更新されます。</p></div>
        <div class="faq-item"><h4>Q. 分析の精度はどのくらいですか？</h4><p>統計分析であるため、実際の結果とは異なる場合があります。</p></div>
        <div class="faq-item"><h4>Q. モバイルでも使えますか？</h4><p>はい。PC・スマホ・タブレットすべてに対応しています。</p></div>
      </div>
    </div>
  </details>

  <!-- 対応競馬場（アコーディオン） -->
  <details class="card accordion">
    <summary>対応競馬場一覧（24場）<span class="chevron">▶</span></summary>
    <div class="acc-body">
      <div style="margin-bottom:14px;">
        <h4 style="font-size:.8rem;font-weight:700;margin-bottom:6px;">中央競馬（JRA）10場</h4>
        <div class="badges"><span class="badge">札幌</span><span class="badge">函館</span><span class="badge">福島</span><span class="badge">新潟</span><span class="badge">東京</span><span class="badge">中山</span><span class="badge">中京</span><span class="badge">京都</span><span class="badge">阪神</span><span class="badge">小倉</span></div>
      </div>
      <div>
        <h4 style="font-size:.8rem;font-weight:700;margin-bottom:6px;">地方競馬（NAR）14場</h4>
        <div class="badges"><span class="badge">門別</span><span class="badge">盛岡</span><span class="badge">水沢</span><span class="badge">浦和</span><span class="badge">船橋</span><span class="badge">大井</span><span class="badge">川崎</span><span class="badge">金沢</span><span class="badge">笠松</span><span class="badge">名古屋</span><span class="badge">園田</span><span class="badge">姫路</span><span class="badge">高知</span><span class="badge">佐賀</span></div>
      </div>
      <p style="font-size:.68rem;color:var(--muted);margin-top:10px;">※ばんえい競馬（帯広）は対応しておりません。</p>
    </div>
  </details>

  <!-- AD④: 記事最下部 -->
  <div class="adsense-manual ad-bottom">広告枠（記事最下部）</div>
</main>

<!-- FOOTER -->
<footer class="footer">
<div class="footer-inner">
  <div class="footer-grid">
    <div><h3 style="font-size:1rem;">UMA-FREE</h3><p style="font-size:.72rem;line-height:1.8;max-width:320px;">過去5年以上のレースデータをAIで分析し、中央・地方競馬の全レースの偏差値・対戦成績・枠順傾向を完全無料で提供。</p></div>
    <div><h3>コンテンツ</h3><a href="#">分析記事一覧</a><a href="#">よくある質問</a><a href="#">このサイトについて</a><a href="#">AI予測モデルについて</a></div>
    <div><h3>サイトポリシー</h3><a href="#">広告について</a><a href="#">お問い合わせ</a><a href="#">プライバシーポリシー</a><a href="#">利用規約</a><a href="#">サイトマップ</a></div>
  </div>
  <div class="footer-bottom"><p>&copy; 2026 UMA-FREE. All Rights Reserved.</p><p>本サイトは統計情報の提供を目的としており、投票の推奨ではありません。</p></div>
</div>
</footer>

<!-- AD③: スティッキーフッター -->
<div class="adsense-manual ad-sticky" id="stickyAd">
  <button class="ad-close" id="stickyClose" aria-label="広告を閉じる">&times;</button>
  広告枠（スティッキーフッター固定）
</div>

<script>
// モバイルメニュー
const menuBtn=document.getElementById('menuBtn'),overlay=document.getElementById('overlay'),mobileMenu=document.getElementById('mobileMenu');
function toggleMenu(){const o=mobileMenu.classList.toggle('open');overlay.classList.toggle('active',o);document.body.style.overflow=o?'hidden':'';}
menuBtn.addEventListener('click',toggleMenu);
overlay.addEventListener('click',toggleMenu);
mobileMenu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{mobileMenu.classList.remove('open');overlay.classList.remove('active');document.body.style.overflow='';}));

// スティッキー広告閉じる
document.getElementById('stickyClose').addEventListener('click',()=>{
  document.getElementById('stickyAd').style.display='none';
  document.body.style.paddingBottom='0';
});

// デスクトップ用記事グリッドのレスポンシブ表示切替
function handleArticlesResponsive(){
  const grid=document.querySelector('.articles-grid');
  const list=document.querySelector('.articles-list');
  if(!grid||!list)return;
  if(window.innerWidth>=640){
    grid.style.display='grid';
    list.style.display='none';
  } else {
    grid.style.display='none';
    list.style.display='flex';
  }
}
handleArticlesResponsive();
window.addEventListener('resize',handleArticlesResponsive);
</script>
</body>
</html>"""

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write(HTML_BODY)

print(f"Generated: {OUTPUT}")
print(f"File size: {os.path.getsize(OUTPUT):,} bytes")
