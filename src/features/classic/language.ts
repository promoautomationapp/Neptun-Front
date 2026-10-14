(() => {
  "use strict";
  const words: Record<string, string> = {
    
    "Welcome back": "Mirë se u kthyet",
    "Sign in to open your campaign workspace.":
      "Hyni për të hapur hapësirën e fushatës.",
    "Open your campaign workspace with one click.":
      "Hapni hapësirën e fushatës me një klikim.",
    "Email address": "Adresa e emailit",
    Password: "Fjalëkalimi",
    "Sign in to Neptun": "Hyni në Neptun",
    "Presentation demo · Enter any email and password to continue. No credentials are stored.":
      "Demo prezantimi · Vendosni çfarëdo emaili dhe fjalëkalimi për të vazhduar. Të dhënat nuk ruhen.",
    "Presentation demo · No email or password required.":
      "Demo prezantimi · Nuk kërkohet email apo fjalëkalim.",
    "Campaigns, prepared with care.": "Fushata, të përgatitura me kujdes.",
    "Sign out": "Dilni",
    "Powered by": "Mundësuar nga",
    "All rights reserved.": "Të gjitha të drejtat e rezervuara.",
    "Start guided walkthrough": "Nisni udhëzuesin hap pas hapi",
    "Step 1 of 4": "Hapi 1 nga 4",
    "Step 2 of 4": "Hapi 2 nga 4",
    "Step 3 of 4": "Hapi 3 nga 4",
    "Step 4 of 4": "Hapi 4 nga 4",
    
    
    "Check details and prices": "Kontrolloni detajet dhe çmimet",
    
    "The selected Neptun campaign is loaded from the brochure library. Product codes, names and prices stay together.":
      "Fushata e zgjedhur e Neptun është ngarkuar nga biblioteka. Kodet, emrat dhe çmimet e produkteve ruhen së bashku.",
    "Check each image against its product code and model. Automatic website lookup and background removal still need a backend connection.":
      "Krahasoni çdo imazh me kodin dhe modelin e produktit. Kërkimi automatik dhe heqja e sfondit ende kërkojnë lidhje me sistemin.",
    "Review product names, specifications, prices, warranties and installments. Fix anything flagged before exporting.":
      "Kontrolloni emrat, specifikat, çmimet, garancionet dhe këstet. Korrigjoni çdo shënim para shkarkimit.",
    "Review the brochure pages. Products that still need attention stay marked as draft until the team finishes checking them.":
      "Kontrolloni faqet e broshurës. Produktet që kërkojnë vëmendje shënohen si provizore derisa ekipi t’i kontrollojë.",
    Back: "Mbrapa",
    "Next step": "Hapi tjetër",
    "Finish walkthrough": "Përfundoni udhëzuesin",
    "Exit walkthrough": "Mbyllni udhëzuesin",
    "The workflow": "Procesi",
    
    "The pilot": "Prova pilot",
    "YOUR SPREADSHEET. YOUR PRODUCTS. YOUR BRAND.":
      "SPREADSHEETA JUAJ. PRODUKTET TUAJA. MARKA JUAJ.",
    "Less image hunting.": "Më pak kërkim imazhesh.",
    More: "Më shumë",
    "campaigns ready.": "fushata gati.",
    "Bring your product list. Match the images, prepare them once, and turn approved products into a Neptun brochure.":
      "Ngarkoni listën e produkteve, gjeni imazhet, përgatitini një herë dhe krijoni broshurën e Neptun.",
    "Explore your campaign": "Shihni fushatën",
    "See the workflow": "Shihni procesin",
    "Excel and CSV uploads · Neptun design · Saved campaign library":
      "Ngarkoni Excel ose CSV · Dizajni Neptun · Biblioteka e fushatave",
    "upload your spreadsheet": "ngarkoni spreadsheet-in",
    "review products and images": "kontrolloni produktet dhe imazhet",
    "preview, save and download": "parapamje, ruajtje dhe shkarkim",
    "FROM REPETITIVE WORK TO A REUSABLE PROCESS":
      "NGA PUNË E PËRSËRITUR TE NJË PROCES I RIPËRDORSHËM",
    "Every product has a path": "Çdo produkt ka rrugën",
    "to the page.": "deri te faqja.",
    "01 / IMPORT": "01 / IMPORTIMI",
    "Start with their Excel": "Filloni me Excel-in e tyre",
    "Product codes, specifications, prices, installments and warranties stay together.":
      "Kodet, specifikat, çmimet, këstet dhe garancionet e produkteve qëndrojnë së bashku.",
    "02 / MATCH": "02 / GJETJA",
    "Find the right image": "Gjeni imazhin e duhur",
    "Match by code and model. Review uncertain results before using a product image.":
      "Kërkoni sipas kodit dhe modelit. Kontrolloni rezultatet para përdorimit të imazhit.",
    "Website lookup · backend connection needed":
      "Kërkimi në uebfaqe · nevojitet lidhje me sistemin",
    "03 / PREPARE": "03 / PËRGATITJA",
    "Approve once. Reuse.": "Aprovoni një herë. Ripërdoreni.",
    "Remove backgrounds, check the edges, and save the approved image for the next campaign.":
      "Hiqni sfondin, kontrolloni skajet dhe ruajeni imazhin për fushatën tjetër.",
    "Background removal · backend connection needed":
      "Heqja e sfondit · nevojitet lidhje me sistemin",
    "04 / PUBLISH": "04 / PUBLIKIMI",
    "Build the brochure": "Krijoni broshurën",
    "Keep product details and pricing consistent inside your branded page layout.":
      "Mbani të njëjtat detaje dhe çmime në faqosjen e markës suaj.",
    "Multi-page preview and PDF printing": "Parapamje me shumë faqe dhe PDF",
    "LIVE PRESENTATION WORKSPACE": "HAPËSIRA E PREZANTIMIT",
    "Your next campaign,": "Fushata juaj e radhës,",
    "starting with real data.": "me të dhëna reale.",
    "Upload your next spreadsheet, prepare product images, and save each campaign in your brochure library.":
      "Ngarkoni spreadsheet-in, përgatitni imazhet e produkteve dhe ruajeni fushatën në bibliotekën e broshurave.",
    "PREPARED FOR NEPTUN KOSOVO": "PËRGATITUR PËR NEPTUN KOSOVËN",
    "My brochures": "Broshurat e mia",
    "March, April, June — every campaign in one place.":
      "Mars, prill, qershor — të gjitha fushatat në një vend.",
    "+ New brochure": "＋ Broshurë e re",
    "Restore backup": "Riktheni kopjen rezervë",
    "Saved on this browser and computer. Download backups to move brochures or keep a separate copy.":
      "Ruhet në këtë shfletues dhe kompjuter. Shkarkoni kopje rezervë për t’i ruajtur ose bartur broshurat.",
    "NEPTUN / BROCHURE": "NEPTUN / BROSHURË",
    "products ·": "produkte ·",
    pages: "faqe",
    "Brochure name": "Emri i broshurës",
    "Offer dates / subtitle": "Datat e ofertës / nëntitulli",
    "Default category": "Kategoria kryesore",
    Duplicate: "Dyfisho",
    "Download backup": "Shkarko kopjen rezervë",
    "Neptun template · saved locally with downloadable backups":
      "Modeli Neptun · ruhet lokalisht me kopje rezervë të shkarkueshme",
    "Your campaign. Neptun’s design.": "Fushata juaj. Dizajni i Neptun.",
    "Më shumë teknologji,": "Më shumë teknologji,",
    "më shumë oferta për të zgjedhur!": "më shumë oferta për të zgjedhur!",
    "Your next campaign, starting with real data.":
      "Fushata juaj e radhës, me të dhëna reale.",
    "Product list": "Lista e produkteve",
    "Image review": "Kontrolli i imazheve",
    "Price checks": "Kontrolli i çmimeve",
    "Product details": "Detajet e produktit",
    Brochure: "Broshura",
    "Upload a spreadsheet": "Ngarkoni spreadsheet",
    "Excel (.xlsx, .xls) or CSV. Choose the sheet, header row and columns before importing.":
      "Excel (.xlsx, .xls) ose CSV. Zgjidhni fletën, rreshtin e titujve dhe kolonat para importimit.",
    "Upload spreadsheet": "Ngarkoni spreadsheet",
    "Search code or product": "Kërkoni kodin ose produktin",
    "Search products": "Kërkoni produkte",
    Include: "Përfshi",
    "Product code": "Kodi i produktit",
    Product: "Produkti",
    Regular: "Çmimi i rregullt",
    Campaign: "Fushata",
    Review: "Kontrolli",
    "Not mapped": "Pa lidhje",
    "Create brochure from this spreadsheet":
      "Krijo broshurë nga ky spreadsheet",
    "Match your columns": "Lidhni kolonat",
    Worksheet: "Fleta",
    "Header row": "Rreshti i titujve",
    Specifications: "Specifikat",
    "Regular price *": "Çmimi i rregullt *",
    "Campaign price *": "Çmimi i fushatës *",
    "Warranty (years)": "Garancioni (vite)",
    "Installments (months)": "Këstet (muaj)",
    Category: "Kategoria",
    Brand: "Marka",
    "Tidy spacing": "Rregullo hapësirat",
    "Review every detail": "Kontrolloni çdo detaj",
    "Changes are saved automatically and appear in the brochure preview.":
      "Ndryshimet ruhen automatikisht dhe shfaqen në parapamjen e broshurës.",
    "Spelling suggestions appear as you type when your browser has an Albanian dictionary enabled. Right-click underlined words for suggestions. Product codes and model numbers are kept unchanged.":
      "Sugjerimet drejtshkrimore shfaqen gjatë shkrimit nëse shfletuesi ka fjalorin shqip. Klikoni me të djathtën mbi fjalën e nënvizuar për sugjerime. Kodet dhe modelet nuk ndryshohen.",
    "Preview brochure →": "Shihni parapamjen →",
    "Savings:": "Kurseni:",
    estimate: "vlerësim",
    "A sample page, ready for review.": "Një faqe shembull, gati për kontroll.",
    "Your brochure preview": "Parapamja e broshurës suaj",
    "Download PDF": "Shkarko PDF",
    "Download draft PDF": "Shkarko PDF provizore",
    "Download brochure": "Shkarko broshurën",
    "Download draft brochure": "Shkarko broshurën provizore",
    Print: "Printo",
    "products need review": "produkte duhen kontrolluar",
    "Products from the spreadsheet": "Produktet nga spreadsheet-i",
    "needs image source": "duhet imazhi",
    "Needs image": "Mungon imazhi",
    "Image needed": "Nevojitet imazh",
    "Check price": "Kontrolloni çmimin",
    "Missing code": "Mungon kodi",
    "Missing name": "Mungon emri",
    "Check prices": "Kontrolloni çmimet",
    "Missing image": "Mungon imazhi",
    "Approve image": "Aprovoni imazhin",
    
    
    "Check the model. Approve the image.":
      "Kontrolloni modelin. Aprovoni imazhin.",
    "Human review stays in control before a reference image enters the page.":
      "Imazhi kontrollohet nga ekipi para se të futet në faqe.",
    "Supplied brochure image": "Imazhi nga broshura",
    "Same asset · placement preview": "I njëjti imazh · parapamja në faqe",
    "Approve reference image": "Aprovoni imazhin",
    "Undo approval": "Anuloni aprovimin",
    "Review reference images →": "Kontrolloni imazhet →",
    "A practical first step": "HAPI I PARË PRAKTIK",
    "Prove it with one campaign.": "Provojeni me një fushatë.",
    "Neptun provides": "Neptun siguron",
    "We demonstrate": "Ne demonstrojmë",
    "Measure together": "Matim së bashku",
    "Original website ↗": "Uebfaqja origjinale ↗",
    "Prepared for Neptun Kosovo · Presentation prototype":
      "Përgatitur për Neptun Kosovë · Prototip prezantimi",
    "PDF opens the print dialog: choose Save as PDF, A4 paper, background graphics on, and browser headers/footers off.":
      "PDF hap dritaren e printimit. Zgjidhni “Save as PDF” dhe formatin A4.",
    "Presentation sample": "Shembull prezantimi",
    "A presentation demo": "Demo prezantimi",
    "My brochure": "Broshura ime",
    "Your spreadsheet. Already mapped.":
      "Spreadsheet-i juaj, gati për përdorim.",
    "117 products from the supplied file. No costs or margin data are displayed.":
      "117 produkte nga skedari i dhënë. Kostot dhe marzhet nuk shfaqen.",
    "Their spreadsheet. Already mapped.":
      "Spreadsheet-i i tyre, gati për përdorim.",
    "Review prices and images before downloading.":
      "Kontrolloni çmimet dhe imazhet para shkarkimit.",
    "Product code *": "Kodi i produktit *",
    "Product name *": "Emri i produktit *",
    "Presentation prototype": "Prototip prezantimi",
    "This is a preloaded spreadsheet snapshot, not a live upload.":
      "Ky është shembull i parapërgatitur, jo ngarkim i drejtpërdrejtë.",
    "Importing creates a new brochure, preserving the current one. Only mapped brochure fields are saved; other spreadsheet columns are ignored.":
      "Importimi krijon broshurë të re dhe ruan atë aktuale. Ruhen vetëm kolonat e lidhura me broshurën.",
    "Preview includes unfinished products. Before downloading, add and approve images and correct missing names, codes or invalid prices. Exclude unwanted products in Product list.":
      "Parapamja përfshin produkte të papërfunduara. Para shkarkimit shtoni dhe aprovoni imazhet, plotësoni emrat e kodet dhe korrigjoni çmimet. Përjashtoni produktet e padëshiruara te Lista e produkteve.",
    "For bulk upload, name each file with its product code, for example 84066697.png.":
      "Për ngarkim në grup, emërtoni skedarët me kodin e produktit, p.sh. 84066697.png.",
    "Product images": "Imazhet e produkteve",
    "Add images by code": "Shtoni imazhe sipas kodit",
    "Approved for brochure": "Aprovuar për broshurë",
    "Spelling suggestions appear as you type":
      "Sugjerimet drejtshkrimore shfaqen gjatë shkrimit",
    "local storage is unavailable": "hapësira lokale nuk është e disponueshme",
    "Saved on this browser": "Ruhet në këtë shfletues",
    "Enter a positive campaign price no higher than the regular price.":
      "Vendosni çmim pozitiv të fushatës, jo më të lartë se çmimi i rregullt.",
    "PDF could not be created:": "PDF nuk u krijua:",
    Downloaded: "U shkarkua",
    Campaigns: "Fushatat",
    "How it works": "Si funksionon",
    "Open workspace": "Hap hapësirën e punës",
    "NEPTUN KOSOVO · CAMPAIGN WORKSPACE":
      "NEPTUN KOSOVË · HAPËSIRA E FUSHATAVE",
    
    "Campaign studio": "Studio e fushatës",
    
    "How the workflow works": "Si funksionon procesi",
    "Choose a step to open it in the campaign workspace.":
      "Zgjidhni një hap për ta hapur në hapësirën e fushatës.",
    
    Import: "Importimi",
    
    Images: "Imazhet",
    
    Details: "Detajet",
    
    "Preview and download": "Parapamje dhe shkarkim",
    "STEP 01 · IMPORT": "HAPI 01 · IMPORTIMI",
    "STEP 02 · IMAGES": "HAPI 02 · IMAZHET",
    "STEP 03 · DETAILS": "HAPI 03 · DETAJET",
    "STEP 04 · BROCHURE": "HAPI 04 · BROSHURA",
    "Start with the spreadsheet": "Filloni me spreadsheet-in",
    
    "Match and approve product images":
      "Përputhni dhe aprovoni imazhet e produkteve",
    
    "Check the details and prices": "Kontrolloni detajet dhe çmimet",
    
    "Preview and download the brochure": "Shikoni dhe shkarkoni broshurën",
    
    "Open this step": "Hapni këtë hap",
    "Open product list": "Hapni listën e produkteve",
    "Review product images": "Kontrolloni imazhet e produkteve",
    "Check product details": "Kontrolloni detajet e produkteve",
    "Preview the brochure": "Shikoni broshurën",
    "NEPTUN KOSOVO · CAMPAIGN ARCHIVE": "NEPTUN KOSOVË · ARKIVI I FUSHATAVE",
    "Previous campaigns": "Fushatat e mëparshme",
    "saved campaigns · open one to continue working.":
      "fushata të ruajtura · hapni njërën për të vazhduar.",
    "+ New campaign": "＋ Fushatë e re",
    "Search campaigns": "Kërkoni fushata",
    "Filter campaigns": "Filtro fushatat",
    All: "Të gjitha",
    "Needs review": "Duhet kontrolluar",
    Ready: "Gati",
    Sort: "Renditja",
    
    
    "Name A–Z": "Emri A–Z",
    products: "produkte",
    "Newest first": "Më të rejat së pari",
    "Oldest first": "Më të vjetrat së pari",
    "NEPTUN · CAMPAIGN": "NEPTUN · FUSHATË",
    "Open campaign": "Hapni fushatën",
    "Currently open": "E hapur tani",
    "No campaigns match this search. Try another name or filter.":
      "Nuk ka fushata që përputhen. Provoni emër ose filtër tjetër.",
    "No campaigns yet": "Ende nuk ka fushata",
    "Create a campaign or restore a saved backup to get started.":
      "Krijoni fushatë ose riktheni një kopje rezervë për të filluar.",
    "Campaign settings and backup": "Cilësimet dhe kopja rezervë e fushatës",
    "Campaign name": "Emri i fushatës",
    "Duplicate campaign": "Dyfisho fushatën",
    "SELECTED CAMPAIGN": "FUSHATA E ZGJEDHUR",
    "Choose a step above to continue.":
      "Zgjidhni një hap më sipër për të vazhduar.",
    "Changes save automatically on this browser.":
      "Ndryshimet ruhen automatikisht në këtë shfletues.",
    "Neptun campaign workspace": "Hapësira e fushatave të Neptun",
    "Create a campaign above, then upload its spreadsheet to add products.":
      "Krijoni një fushatë më sipër, pastaj ngarkoni spreadsheet-in për të shtuar produktet.",
    "Start with your spreadsheet": "Filloni me spreadsheet-in tuaj",
    "Your product list will appear here after you upload and import a campaign file.":
      "Lista e produkteve do të shfaqet këtu pasi të ngarkoni dhe importoni skedarin e fushatës.",

    "Prepare a campaign, review its products, and find previous editions in one place.":
      "Përgatitni fushatën, kontrolloni produktet dhe gjeni botimet e mëparshme në një vend.",
    "YOUR CAMPAIGN, STEP BY STEP": "FUSHATA JUAJ, HAP PAS HAPI",
    "Campaign workflow": "Procesi i fushatës",
    "Upload the spreadsheet": "Ngarkoni spreadsheet-in",
    "Match and approve": "Përputhni dhe aprovoni",
    "Check copy and prices": "Kontrolloni tekstin dhe çmimet",
    "Bring in the campaign list. Match its columns once, then keep every product code and offer together.":
      "Ngarkoni listën e fushatës. Lidhni kolonat një herë dhe ruani bashkë kodin dhe ofertën e çdo produkti.",
    "Review each image against its code and model. Upload images in batches by product code, then approve the ones the team has checked.":
      "Kontrolloni çdo imazh sipas kodit dhe modelit. Ngarkoni imazhe sipas kodit dhe aprovoni ato që ka kontrolluar ekipi.",
    "Confirm product names, specifications, campaign prices, warranties and installments before the brochure is made.":
      "Konfirmoni emrat, specifikat, çmimet e fushatës, garancionet dhe këstet para krijimit të broshurës.",
    "Review the finished pages, choose a format, and download the current campaign when its details are ready.":
      "Kontrolloni faqet, zgjidhni formatin dhe shkarkoni fushatën kur detajet të jenë gati.",
  };
  Object.assign(words, {
    "Open a saved campaign or start a new one.":
      "Hapni një fushatë të ruajtur ose filloni një të re.",
    "OPTIONAL QUICK GUIDE": "UDHËZUES I SHKURTËR SIPAS DËSHIRËS",
    "How it works": "Si funksionon",
    "See the four steps from spreadsheet to finished brochure.":
      "Shihni katër hapat nga spreadsheet-i deri te broshura e përfunduar.",
    "Show the four steps": "Shfaq katër hapat",
    "Hide the steps": "Fshih hapat",
    "Prices and product text": "Çmimet dhe teksti i produkteve",
    "Prices update as you type and save automatically. Product codes stay in your workspace, but are hidden from brochure pages.":
      "Çmimet përditësohen gjatë shkrimit dhe ruhen automatikisht. Kodet mbeten në hapësirën tuaj, por nuk shfaqen në broshurë.",
    "Clean spacing in all text": "Rregullo hapësirat në tekst",
    "Quick price check": "Kontroll i shpejtë i çmimeve",
    "Edit prices right here—no need to open each product. Savings and monthly amounts calculate automatically.":
      "Ndryshoni çmimet këtu, pa hapur secilin produkt. Kursimi dhe kësti mujor llogariten automatikisht.",
    "Regular price (€)": "Çmimi i rregullt (€)",
    "Campaign price (€)": "Çmimi i fushatës (€)",
    "Months (optional)": "Muajt (opsionale)",
    "Savings / monthly estimate": "Kursimi / kësti mujor",
    "Spelling and product text": "Drejtshkrimi dhe teksti i produktit",
    "Open a product to edit its name, specifications, warranty or category. Underlined words may have spelling suggestions.":
      "Hapni produktin për të ndryshuar emrin, specifikat, garancionin ose kategorinë. Fjalët e nënvizuara mund të kenë sugjerime drejtshkrimore.",
    "Review one at a time": "Kontrolloni një nga një",
    "Spelling help": "Ndihmë për drejtshkrimin",
    "Click into a name or specification and use your browser’s spelling suggestions (right-click an underlined word). Suggestions depend on your browser’s Albanian dictionary. “Clean spacing” only fixes extra spaces and punctuation spacing; it does not rewrite product names or model numbers.":
      "Klikoni te emri ose specifikat dhe përdorni sugjerimet e shfletuesit (klikoni me të djathtën mbi fjalën e nënvizuar). Sugjerimet varen nga fjalori shqip i shfletuesit. “Rregullo hapësirat” pastron vetëm hapësirat e tepërta dhe pikësimin; nuk rishkruan emrat apo modelet.",
    "Product name": "Emri i produktit",
    "Warranty (years)": "Garancioni (vite)",
    "Edit text": "Ndrysho tekstin",
    "Needs name": "Mungon emri",
    "Check prices": "Kontrolloni çmimet",
    Optional: "Opsionale",
    " / month": " / muaj",
  });
  Object.assign(words, {
    "Run the AI text check to review suggested spelling and formatting fixes before accepting them.":
      "Ekzekutoni kontrollin e tekstit me AI për të parë sugjerimet drejtshkrimore dhe të formatimit para se t’i pranoni.",
    "Review one at a time": "Kontrolloni një nga një",
    "✦ Run AI text check": "✦ Kontrollo tekstin me AI",
    "AI text check · demo": "Kontrolli i tekstit me AI · demo",
    "This sample works in the HTML without an AI service. It offers cautious Albanian spelling and formatting suggestions for you to review. Connect an AI backend later for context-aware corrections. Product codes and model numbers are protected.":
      "Ky shembull punon në HTML pa shërbim AI. Jep sugjerime të kujdesshme drejtshkrimore dhe formatimi në shqip për t’i kontrolluar. Lidhni më vonë një sistem AI për korrigjime sipas kontekstit. Kodet e produkteve dhe numrat e modeleve mbrohen.",
    "These sample suggestions run in this file. Connect your AI service later for context-aware corrections.":
      "Këto sugjerime shembull funksionojnë në këtë skedar. Lidhni më vonë shërbimin AI për korrigjime sipas kontekstit.",
    "Accept all suggestions": "Prano të gjitha sugjerimet",
    "Keep original": "Mbaje tekstin origjinal",
    "Accept fix": "Prano korrigjimin",
    "No sample text fixes found. You can still edit any product manually below.":
      "Nuk u gjetën korrigjime shembull. Mund ta ndryshoni tekstin e produktit më poshtë.",
    "All suggestions reviewed.": "Të gjitha sugjerimet u kontrolluan.",
    "Product name": "Emri i produktit",
    Specifications: "Specifikat",
    Applied: "U aplikuan",
  });
  Object.assign(words, {
    "All months": "Të gjithë muajt",
    "Campaign month": "Muaji i fushatës",
    "Choose month": "Zgjidhni muajin",
    "Month not set": "Muaji nuk është caktuar",
    "No campaigns in this month. Choose another month or create one.":
      "Nuk ka fushata në këtë muaj. Zgjidhni një muaj tjetër ose krijoni fushatë.",
    "Add products": "Shtoni produkte",
    January: "Janar",
    February: "Shkurt",
    March: "Mars",
    April: "Prill",
    May: "Maj",
    June: "Qershor",
    July: "Korrik",
    August: "Gusht",
    September: "Shtator",
    October: "Tetor",
    November: "Nëntor",
    December: "Dhjetor",
  });
  Object.assign(words, {
    "See the four steps from product list to finished brochure.":
      "Shihni katër hapat nga lista e produkteve te broshura e përfunduar.",
    Products: "Produktet",
    "Build or upload": "Krijoni ose ngarkoni",
    "STEP 01 · PRODUCTS": "HAPI 01 · PRODUKTET",
    "Build your product list": "Krijoni listën e produkteve",
    "Add products here or import an existing spreadsheet. Prices and savings update while you work.":
      "Shtoni produktet këtu ose importoni një tabelë ekzistuese. Çmimet dhe kursimet përditësohen gjatë punës.",
    "Create a campaign above, then add products here or upload a spreadsheet.":
      "Krijoni një fushatë më sipër, pastaj shtoni produktet këtu ose ngarkoni një tabelë.",
    "Add and edit products here. Retail and campaign prices calculate savings automatically.":
      "Shtoni dhe ndryshoni produktet këtu. Çmimet e shitjes dhe fushatës llogarisin kursimin automatikisht.",
    "Upload Excel or CSV": "Ngarkoni Excel ose CSV",
    "Product codes stay in the workspace and do not appear in the brochure.":
      "Kodet e produkteve mbeten në hapësirën e punës dhe nuk shfaqen në broshurë.",
    "Download spreadsheet": "Shkarkoni tabelën",
    "+ Add product": "+ Shtoni produkt",
    "Search products": "Kërkoni produkte",
    Use: "Përdor",
    "Product code": "Kodi i produktit",
    "Product name": "Emri i produktit",
    "Retail price (€)": "Çmimi i shitjes (€)",
    "Campaign price (€)": "Çmimi i fushatës (€)",
    "You save": "Kurseni",
    Actions: "Veprimet",
    Details: "Detajet",
    Remove: "Hiq",
    "No products yet": "Ende nuk ka produkte",
    "Add your first product to build the campaign here. You can also upload an existing Excel or CSV file.":
      "Shtoni produktin e parë për ta krijuar fushatën këtu. Mund të ngarkoni edhe një skedar Excel ose CSV.",
    "More fields such as brand, specifications, warranty and installments are in each product’s Details.":
      "Fusha të tjera si marka, specifikat, garancioni dhe këstet gjenden te Detajet e çdo produkti.",
    "Continue to images →": "Vazhdoni te imazhet →",
    "Importing a file creates a separate campaign, so the product list you build here stays saved.":
      "Importimi i një skedari krijon fushatë të veçantë, prandaj lista që krijoni këtu mbetet e ruajtur.",
    "Add prices": "Shtoni çmimet",
    "Check prices": "Kontrolloni çmimet",
    "Warranty (years)": "Garancioni (vite)",
    "Installments (months)": "Këstet (muaj)",
    Category: "Kategoria",
    Brand: "Marka",
    Specifications: "Specifikat",
  });
  Object.assign(words, {
    "Add products and prices here. Product photos are suggested from Neptun Kosovo as you type a code or name.":
      "Shtoni produktet dhe çmimet këtu. Fotografitë e produkteve sugjerohen nga Neptun Kosova gjatë shkrimit të kodit ose emrit.",
    "Find photo on Neptun": "Gjej foto në Neptun",
    "Change photo": "Ndrysho foton",
    "Photos from Neptun Kosovo": "Fotografi nga Neptun Kosova",
    "Check the code and model before choosing.":
      "Kontrolloni kodin dhe modelin para se të zgjidhni.",
    Close: "Mbyll",
    "Use this photo": "Përdor këtë foto",
    "Adding photo…": "Po shtohet fotografia…",
    "View on Neptun ↗": "Shih në Neptun ↗",
    "Searching Neptun Kosovo…": "Po kërkohet në Neptun Kosova…",
    "No matching product photo found on Neptun. Check the code or use Upload image in the Images step.":
      "Nuk u gjet fotografi e produktit në Neptun. Kontrolloni kodin ose ngarkoni një fotografi te hapi Imazhet.",
    "Enter a product code or at least four letters of the product name.":
      "Shkruani kodin e produktit ose të paktën katër shkronja të emrit.",
    "Use photos found from Neptun in the Product list, or upload PNG, JPEG or WebP images here.":
      "Përdorni fotografitë e gjetura në Neptun te Lista e produkteve ose ngarkoni imazhe PNG, JPEG apo WebP këtu.",
    "For bulk upload, name each file with its product code, for example 84066697.png. Use Find photo on Neptun in Product list to search the live product catalog, or upload images here. Review every image before approving it. Background removal is not connected.":
      "Për ngarkim në grup, emërtoni skedarët me kodin e produktit, p.sh. 84066697.png. Te Lista e produkteve përdorni Gjej foto në Neptun për të kërkuar në katalog, ose ngarkoni imazhe këtu. Kontrolloni çdo imazh para aprovimit. Heqja e sfondit nuk është lidhur.",
    "Find Neptun photos by product code or name, or upload your own. Check the model before approving each image.":
      "Gjeni fotografitë e Neptun sipas kodit ose emrit të produktit, ose ngarkoni tuajat. Kontrolloni modelin para aprovimit.",
  });
  Object.assign(words, {
    "Use this product": "Përdor këtë produkt",
    "Selecting product…": "Po zgjidhet produkti…",
    "Selected:": "U zgjodh:",
    "Product code, name and available details were added to the row.":
      "Kodi, emri dhe detajet e disponueshme u shtuan në rresht.",
    "Original Neptun photo": "Fotografia origjinale nga Neptun",
    "Background removal": "Heqja e sfondit",
    "Preparing cutout…": "Po përgatitet fotografia pa sfond…",
    "Checking the AI background-removal connection…":
      "Po kontrollohet lidhja me sistemin AI për heqjen e sfondit…",
    "AI background removal complete. Check the edges before using this cutout.":
      "Heqja e sfondit me AI përfundoi. Kontrolloni skajet para përdorimit.",
    "Demo cutout preview. Connect your AI backend for production-quality removal; check the edges before using it.":
      "Parapamje e heqjes së sfondit në demo. Lidhni sistemin tuaj AI për cilësi prodhimi dhe kontrolloni skajet.",
    "AI backend not connected. Creating a demo cutout from the light background…":
      "Sistemi AI nuk është lidhur. Po krijohet një shembull nga sfondi i çelët…",
    "AI service unavailable. Creating a demo cutout from the light background…":
      "Shërbimi AI nuk është i disponueshëm. Po krijohet një shembull nga sfondi i çelët…",
    "Demo cutout unavailable": "Shembulli pa sfond nuk është i disponueshëm",
    "Use cutout": "Përdor pa sfond",
    "Keep original photo": "Mbaj fotografinë origjinale",
    "Saving cutout…": "Po ruhet fotografia pa sfond…",
    "AI cutout · review edges": "Heqje me AI · kontrolloni skajet",
    "Demo cutout · review edges": "Shembull pa sfond · kontrolloni skajet",
    "Review every image before approving it. A demo cutout is available when choosing a product; connect your AI backend for production background removal.":
      "Kontrolloni çdo imazh para aprovimit. Gjatë zgjedhjes së produktit mund të shihni një shembull pa sfond; lidhni sistemin tuaj AI për heqje profesionale.",
  });
  const reverse: Record<string, string> = Object.fromEntries(
    Object.entries(words).map(([a, b]) => [b, a]),
  );
  let lang: "en" | "sq" = "en";
  try {
    lang = localStorage.getItem("neptun-language") === "sq" ? "sq" : "en";
  } catch {}
  const originals = new WeakMap<Text, string>();
  const originalAttributes = new WeakMap<Element, Record<string, string>>();
  function textMap(raw: string, to: "en" | "sq") {
    let value = raw;
    if (to === "en") return reverse[value] || value;
    value = words[value] || value;
    let m = value.match(/^Updated (.+)$/);
    if (m) return `Përditësuar ${m[1]}`;
    m = value.match(/^([0-9]+) images need review$/);
    if (m) return `${m[1]} imazhe duhen kontrolluar`;
    m = value.match(/^(\d+) products? · (\d+) pages?$/);
    if (m) return `${m[1]} produkte · ${m[2]} faqe`;
    m = value.match(/^(\d+) products? need review$/);
    if (m) return `${m[1]} produkte duhen kontrolluar`;
    m = value.match(/^(\d+) products?$/);
    if (m) return `${m[1]} produkte`;
    m = value.match(/^(\d+) pages?$/);
    if (m) return `${m[1]} faqe`;
    m = value.match(/^(\d+) products? in the selected campaign$/);
    if (m) return `${m[1]} produkte në fushatën e zgjedhur`;
    m = value.match(/^(\d+) products? · (\d+) to complete$/);
    if (m) return `${m[1]} produkte · ${m[2]} për t'u plotësuar`;
    m = value.match(/^(\d+) saved campaigns · open one to continue working\.$/);
    if (m) return `${m[1]} fushata të ruajtura · hapni njërën për të vazhduar.`;
    m = value.match(
      /^(\d+) products? loaded · (\d+) of (\d+) reference images approved$/,
    );
    if (m)
      return `${m[1]} produkte të ngarkuara · ${m[2]} nga ${m[3]} imazhe reference të aprovuara`;
    m = value.match(/^Downloaded (\d+)-page (draft )?PDF\.$/);
    if (m) return `U shkarkua PDF ${m[2] ? "provizor " : ""}me ${m[1]} faqe.`;
    m = value.match(/^Created (\d+) products\.$/);
    if (m) return `U krijuan ${m[1]} produkte.`;
    return value;
  }
  function translatableText(n: Text) {
    let p = n.parentElement;
    while (p) {
      if (p.matches("script,style,textarea,[data-user-content]")) return false;
      if (
        p.tagName === "OPTION" &&
        p instanceof HTMLOptionElement &&
        p.value !== "-1" &&
        !p.closest("#library-sort")
      )
        return false;
      p = p.parentElement;
    }
    return true;
  }
  function translateNode(n: Node) {
    if (n instanceof Text) {
      if (!translatableText(n)) return;
      const raw = originals.get(n) ?? n.nodeValue ?? "";
      const trimmed = raw.trim(),
        out = textMap(trimmed, lang);
      if (out !== trimmed) {
        originals.set(n, raw);
        const next = raw.replace(trimmed, out);
        if (n.nodeValue !== next) n.nodeValue = next;
      } else if (lang === "en" && originals.has(n)) {
        if (n.nodeValue !== raw) n.nodeValue = raw;
        originals.delete(n);
      }
      return;
    }
    if (!(n instanceof Element)) return;
    for (const a of ["placeholder", "aria-label", "title"]) {
      if (n.hasAttribute(a)) {
        const stash = originalAttributes.get(n) ?? {};
        if (!stash[a]) stash[a] = n.getAttribute(a) ?? "";
        originalAttributes.set(n, stash);
        const before = stash[a] ?? "",
          after = textMap(before, lang);
        if (n.getAttribute(a) !== after) n.setAttribute(a, after);
      }
    }
    n.childNodes.forEach(translateNode);
  }
  function render() {
    document.documentElement.lang = lang;
    document.documentElement.dir = "ltr";
    document.querySelectorAll<HTMLElement>("[data-language]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.language === lang));
      b.classList.toggle("selected", b.dataset.language === lang);
    });
    translateNode(document.body);
  }
  function setLanguage(v: string) {
    lang = v === "sq" ? "sq" : "en";
    try {
      localStorage.setItem("neptun-language", lang);
    } catch {}
    render();
  }
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target instanceof Element
        ? e.target.closest<HTMLElement>("[data-language]")
        : null;
      if (!b) return;
      e.preventDefault();
      setLanguage(b.dataset.language ?? "en");
    },
    true,
  );
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "childList") r.addedNodes.forEach(translateNode);
      else if (r.type === "characterData") translateNode(r.target);
    }
  }).observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  window.neptunLanguage = {
    set: setLanguage,
    get: () => lang,
    translate: render,
  };
  render();
})();

declare global {
  interface Window {
    neptunLanguage: {
      set: (language: string) => void;
      get: () => "en" | "sq";
      translate: () => void;
    };
  }
}

export {};
