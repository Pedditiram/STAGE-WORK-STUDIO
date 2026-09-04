import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const OUTPUT_DIR = path.resolve('screenshots');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 Launching Chromium to capture Stage Work Studio app screenshots...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  // Preset admin session with real sample film data so every room looks rich & populated
  await page.addInitScript(() => {
    localStorage.setItem('sps_is_admin_logged_in', 'true');
    localStorage.setItem('sps_current_user_email', 'admin@stageworkstudio.com');
    localStorage.setItem('sps_user_role', 'owner');
    localStorage.setItem('sps_pin_app_header', 'true');
    localStorage.setItem('sps_header_minimized', 'false');
    localStorage.setItem('sps_pin_matrix_toolbar', 'true');
    localStorage.setItem('sps_pin_writer_chrome', 'true');
    localStorage.setItem('sps_pin_writer_element_bar', 'true');
    localStorage.setItem('sps_pin_storyboard_bar', 'true');
    localStorage.setItem('sps_pin_pitch_tools_v2', 'true');
    localStorage.setItem('sps_pin_promo_bar', 'true');
    localStorage.setItem('sps_pin_campaign_bar', 'true');
    localStorage.setItem('sps_pin_budget_bar', 'true');
    localStorage.setItem('sps_current_project_title', 'JAI SHRI RAM');
  });

  const baseUrl = 'http://localhost:5173';
  console.log(`Navigating to ${baseUrl}...`);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Helper to take screenshot
  async function snap(filename, desc) {
    const filePath = path.join(OUTPUT_DIR, filename);
    await page.waitForTimeout(800);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`📸 [${desc}] -> ${filename}`);
  }

  // Helper to dismiss any active modal overlay
  async function dismissModals() {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // Also try clicking any close button
    await page.evaluate(() => {
      const closeBtn = document.querySelector('.sps-overlay button[aria-label="Close"], .sps-overlay button:has(.lucide-x)');
      if (closeBtn) closeBtn.click();
    });
    await page.waitForTimeout(300);
  }

  // Helper to safely click a button by title
  async function clickTitle(title) {
    const clicked = await page.evaluate((t) => {
      const btn = document.querySelector(`button[title="${t}"]`) ||
                  document.querySelector(`button[title*="${t}"]`);
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    }, title);
    return clicked;
  }

  // 1. Matrix View (Spreadsheet)
  console.log('\n--- Capturing Primary Studio Rooms ---');
  await page.evaluate(() => {
    localStorage.setItem('sps_active_view', 'spreadsheet');
    window.location.reload();
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await snap('01_Matrix_Craft_Grid.png', '38-Crafts Studio Matrix Grid');

  // 2. Screenplay Editor / Writer Console
  await page.evaluate(() => {
    localStorage.setItem('sps_active_view', 'screenplay');
    window.location.reload();
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await snap('02_Writer_Console_Screenplay.png', 'Screenplay Writer Console');

  // 3. 3D Stage / Scene Builder
  await page.evaluate(() => {
    localStorage.setItem('sps_active_view', 'scene3d');
    window.location.reload();
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
  await snap('03_Scene_Builder_3D_Stage.png', '3D Stage Scene Builder');

  // 4. Storyboard Studio
  await page.evaluate(() => {
    localStorage.setItem('sps_active_view', 'storyboard');
    window.location.reload();
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await snap('04_Storyboard_Studio.png', 'Storyboard Visual Studio');

  // 5. Pitch Deck Maker
  await page.evaluate(() => {
    localStorage.setItem('sps_active_view', 'pitch');
    window.location.reload();
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await snap('05_Pitch_Deck_Studio.png', 'Pitch Deck Maker Studio');

  // 6. Promo Pack Studio
  await page.evaluate(() => {
    localStorage.setItem('sps_active_view', 'promo');
    window.location.reload();
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await snap('06_Promo_Pack_Studio.png', 'Promo Pack Trailer & Reels Studio');

  // 7. Campaign Kit Studio
  await page.evaluate(() => {
    localStorage.setItem('sps_active_view', 'campaign');
    window.location.reload();
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await snap('07_Campaign_Kit_Studio.png', 'Campaign Kit Studio');

  // Return to Spreadsheet view to capture overlay modals cleanly
  await page.evaluate(() => {
    localStorage.setItem('sps_active_view', 'spreadsheet');
    window.location.reload();
  });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  console.log('\n--- Capturing Studio Modals & Consoles ---');

  // 8. Generate Desk Modal
  console.log('Opening Generate Desk...');
  await clickTitle('Generate');
  await page.waitForTimeout(1200);
  await snap('08_Generate_Desk_AI_Engines.png', 'Generate Desk AI Video & Image Engines');
  await dismissModals();

  // 9. Prompt Compiler Modal
  console.log('Opening Prompt Compiler...');
  await clickTitle('Compile');
  await page.waitForTimeout(1200);
  await snap('09_Prompt_Compiler_Master_Cinema.png', 'Prompt Compiler Master Cinema');
  await dismissModals();

  // 10. Budget Console Modal
  console.log('Opening Budget Console...');
  await clickTitle('Budget');
  await page.waitForTimeout(1200);
  await snap('10_Budget_Console.png', 'Budget Console & Cost Estimator');
  await dismissModals();

  // 11. Projects Console / Vault Modal
  console.log('Opening Projects Console...');
  await clickTitle('Projects');
  await page.waitForTimeout(1500);
  await snap('11_Projects_Console_Vault.png', 'Projects Console Disk Vault');
  await dismissModals();

  // 12. Character Bible Modal
  console.log('Opening Character Bible...');
  await clickTitle('Characters');
  await page.waitForTimeout(1200);
  await snap('12_Character_Bible.png', 'Character Bible & Wardrobe Matrix');
  await dismissModals();

  // 13. World & Environment Console Modal
  console.log('Opening World Console...');
  await clickTitle('World');
  await page.waitForTimeout(1200);
  await snap('13_World_Environment_Console.png', 'World & Environment Console');
  await dismissModals();

  // 14. Admin Settings Modal
  console.log('Opening Admin Settings...');
  await clickTitle('Settings');
  await page.waitForTimeout(1200);
  await snap('14_Admin_Settings_Cloud_Collab.png', 'Admin Settings & Cloud Collab');
  await dismissModals();

  // 15. Feature Reel Modal
  console.log('Opening Feature Reel...');
  await clickTitle('Reel');
  await page.waitForTimeout(1200);
  await snap('15_Feature_Reel_Player.png', 'Feature Reel Visual Timeline');
  await dismissModals();

  // 16. Collaborative Chat Panel
  console.log('Opening Collaborative Chat...');
  await clickTitle('Chat');
  await page.waitForTimeout(1200);
  await snap('16_Collaborative_Chat_Panel.png', 'Collaborative Live Team Chat');
  await dismissModals();

  // 17. Help & User Guide Modal
  console.log('Opening Help Guide...');
  await clickTitle('Help');
  await page.waitForTimeout(1200);
  await snap('17_Help_User_Guide.png', 'Help & Comprehensive Architecture Guide');
  await dismissModals();

  // 18. Investor Deck / Presentation Showcase Modal
  console.log('Opening Investor Deck Showcase...');
  await page.evaluate(() => {
    // Open profile menu then click Investor Deck button
    const profileBtn = document.querySelector('.sps-console-profile > button, button.sps-profile-chip');
    if (profileBtn) profileBtn.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const deckBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Investor Deck'));
    if (deckBtn) deckBtn.click();
  });
  await page.waitForTimeout(1500);
  await snap('18_Investor_Deck_Showcase.png', 'Investor Deck Studio Showcase');
  await dismissModals();

  await browser.close();

  // Create ZIP archive of all screenshots
  const zipPath = path.resolve('StageWorkStudio_App_Screenshots.zip');
  console.log(`\n📦 Packaging all screenshots into ${zipPath}...`);
  execSync(`cd "${OUTPUT_DIR}" && zip -r -9 "${zipPath}" ./*`, { stdio: 'inherit' });

  const stats = fs.statSync(zipPath);
  console.log(`\n🎉 DONE! Zip file size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Output archive: ${zipPath}`);
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
