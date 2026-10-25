import { expect, test } from "@playwright/test";

test("selected detail tools stay clear, clickable, and usable in both themes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/__detail-controls-check", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>
      :root{--np-surface:#fff;--np-text:#173b5d;--np-border:#cbdbe8}
      html[data-theme=dark]{--np-surface:#243246;--np-text:#edf5ff;--np-border:#43556e;--np-surface-hover:#34475e;--np-surface-subtle:#34475e;--np-accent:#93d0fc}
      body{margin:0;background:#dbe4ed;font:14px Arial}html[data-theme=dark] body{background:#17212e}
      .brochure-page{position:relative;container-type:inline-size;width:600px;margin:150px auto;padding:50px;background:#e3e3e3}
      .brochure-product{position:relative;min-height:300px}.brochure-specs{display:flex;gap:10px}
      .product-detail-block{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:110px;height:40px;border:1px solid #003870;border-radius:5px;color:#003870;font-size:14px}
    </style></head><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
      const React=(await import('/node_modules/.vite/deps/react.js')).default;
      const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const {ProductDetailBlock}=await import('/src/features/brochure/ProductDetailBlock.tsx');
      const {setLanguage}=await import('/src/features/brochure/i18n.ts');
      await import('/src/styles/brochure-ux.css');setLanguage('en');
      const h=React.createElement;window.changes=[];window.focusedDetail=null;
      function Demo(){const [removed,setRemoved]=React.useState([]);const [product,setProduct]=React.useState({code:'phone',name:'Phone'});
        return h('div',{className:'cs-page-preview edit-view show-guides'},h('section',{className:'brochure-page'},h('article',{className:'brochure-product'},h('div',{className:'brochure-specs'},
          ...['memory','battery','camera'].filter(key=>!removed.includes(key)).map(key=>h(ProductDetailBlock,{key,product,detailKey:key,editText:key,onSaveText:value=>window.changes.push(['text',value]),onEdit:detail=>window.focusedDetail=detail,onRemove:detail=>setRemoved(old=>[...old,detail]),onChange:(field,value)=>{window.changes.push([field,value]);setProduct(old=>({...old,[field]:value}));}},key))
        ))));}createRoot(document.getElementById('root')).render(h(Demo));
    </script></body></html>`,
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem("neptun-studio-language", "en"),
  );
  await page.goto("/__detail-controls-check");
  const rows = page.locator(".product-detail-block");
  await expect(rows).toHaveCount(3);
  await expect(page.getByRole("toolbar")).toHaveCount(0);
  await expect(page.locator(".detail-block-resize")).toHaveCount(0);

  const memory = rows.filter({ hasText: "memory" });
  await memory.click();
  await expect(
    page.getByRole("textbox", { name: "Edit this detail" }),
  ).toBeVisible();
  await page.getByRole("textbox").press("Escape");
  await expect(
    page.getByRole("toolbar", { name: "Detail block: memory" }),
  ).toBeVisible();
  await expect(page.locator(".detail-block-resize")).toHaveCount(4);
  const edit = page.getByRole("button", {
    name: "Edit this detail Detail block: memory",
  });
  const move = page.getByRole("button", { name: "Move Detail block: memory" });
  const editRect = await edit.boundingBox();
  const moveRect = await move.boundingBox();
  expect(editRect!.height).toBeGreaterThanOrEqual(32);
  expect(moveRect!.x).toBeGreaterThanOrEqual(editRect!.x + editRect!.width);
  const rect = await memory.boundingBox();
  expect(editRect!.y + editRect!.height).toBeLessThan(rect!.y);
  await move.hover();
  const start = await move.boundingBox();
  await page.mouse.move(
    start!.x + start!.width / 2,
    start!.y + start!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    start!.x + start!.width / 2 + 24,
    start!.y + start!.height / 2 + 12,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { changes: unknown[][] }).changes.some(
          ([key]) => key === "detailBlockPlacements",
        ),
      ),
    )
    .toBe(true);

  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await page.getByRole("button", { name: "More actions" }).click();
  const remove = page.getByRole("button", {
    name: "Remove detail block: memory",
  });
  await expect(remove).toBeVisible();
  expect(
    await remove.evaluate((element) => {
      const r = element.getBoundingClientRect();
      const top = document.elementFromPoint(
        r.x + r.width / 2,
        r.y + r.height / 2,
      );
      return top === element || element.contains(top);
    }),
  ).toBe(true);
  expect(
    await page
      .getByRole("toolbar")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(36, 50, 70)");
  await page.screenshot({ path: "/tmp/neptun-detail-controls-dark.png" });
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("toolbar")).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await expect(page.getByRole("toolbar")).toBeVisible();
  await remove.click();
  await expect(rows).toHaveCount(2);
  await expect(memory).toHaveCount(0);
  await expect(page.getByRole("toolbar")).toHaveCount(0);
  const battery = rows.filter({ hasText: "battery" });
  await battery.dblclick();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { focusedDetail: string }).focusedDetail,
      ),
    )
    .toBe("battery");
  expect(errors).toEqual([]);
});
