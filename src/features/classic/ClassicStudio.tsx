import { useEffect } from "react";

const logo = "/api/assets/app/logo";

function LanguageSwitch() {
  return (
    <div className="language-switch" aria-label="Select language">
      <button type="button" data-language="en">
        EN
      </button>
      <button type="button" data-language="sq">
        Shqip
      </button>
    </div>
  );
}

function SignIn() {
  return (
    <div id="demo-signin" className="demo-signin">
      <section className="signin-brand">
        <img src={logo} alt="NEPTUN" />
        <p>Brochure Platform</p>
        <div>Campaigns, prepared with care.</div>
      </section>
      <section className="signin-card">
        <div className="eyebrow">PREPARED FOR NEPTUN KOSOVO</div>
        <h1>Welcome back</h1>
        <p className="signin-copy">Open your campaign workspace with one click.</p>
        <form id="demo-signin-form">
          <button className="primary" type="submit">
            Sign in to Neptun <span>→</span>
          </button>
        </form>
        <LanguageSwitch />
        <p className="demo-note">
          Presentation demo · No email or password required.
        </p>
      </section>
    </div>
  );
}

function Header() {
  return (
    <header className="app-header">
      <a
        className="brand header-brand"
        href="#studio"
        aria-label="Neptun campaign workspace"
      >
        <span className="header-neptun">
          <img src={logo} alt="NEPTUN" />
        </span>
        <span className="powered-by">
          <span className="brand-symbol" aria-hidden="true">
            ▥
          </span>
          <span>
            Powered by <strong>BrochurePlatform</strong>
          </span>
        </span>
      </a>
      <nav aria-label="Workspace navigation">
        <a href="#campaigns">Campaigns</a>
        <a href="#workflow">How it works</a>
        <a href="#studio">Open workspace</a>
      </nav>
      <div className="header-actions">
        <LanguageSwitch />
        <button
          className="secondary demo-logout"
          id="demo-logout"
          type="button"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

const steps = [
  ["01", "Products", "Build or upload"],
  ["02", "Images", "Match and approve"],
  ["03", "Details", "Check copy and prices"],
  ["04", "Brochure", "Preview and download"],
];

function Workflow() {
  return (
    <section
      id="workflow"
      className="workflow-overview is-collapsed"
      aria-labelledby="workflow-heading"
    >
      <div className="workflow-summary">
        <div>
          <div className="eyebrow">OPTIONAL QUICK GUIDE</div>
          <h2 id="workflow-heading">How it works</h2>
          <p>See the four steps from product list to finished brochure.</p>
        </div>
        <button
          id="workflow-toggle"
          className="secondary"
          type="button"
          aria-expanded="false"
          aria-controls="workflow-panel"
        >
          <span className="workflow-show">Show the four steps</span>
          <span className="workflow-hide">Hide the steps</span>
          <span className="workflow-chevron" aria-hidden="true">
            ⌄
          </span>
        </button>
      </div>
      <div id="workflow-panel" hidden>
        <div
          className="workflow-steps"
          role="group"
          aria-label="Campaign workflow"
        >
          {steps.map(([number, name, detail], stage) => (
            <button
              className="workflow-step"
              type="button"
              data-workflow-stage={stage}
              aria-pressed={stage === 0}
              key={number}
            >
              <span className="step-number">{number}</span>
              <span>
                <strong>{name}</strong>
                <small>{detail}</small>
              </span>
              <span className="step-arrow">↗</span>
            </button>
          ))}
        </div>
        <div className="workflow-detail" aria-live="polite">
          <div>
            <span className="workflow-detail-kicker" id="workflow-kicker">
              STEP 01 · PRODUCTS
            </span>
            <h3 id="workflow-title">Build your product list</h3>
            <p id="workflow-copy">
              Add products here or import an existing spreadsheet. Prices and
              savings update while you work.
            </p>
          </div>
          <div className="workflow-detail-action">
            <span id="workflow-metric">
              Choose or create a campaign to continue
            </span>
            <button className="primary" id="workflow-open" type="button">
              Open this step <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Workspace() {
  return (
    <section
      id="studio"
      className="workspace-section"
      aria-labelledby="studio-heading"
    >
      <div className="workspace-section-head">
        <div>
          <div className="eyebrow">SELECTED CAMPAIGN</div>
          <h2 id="studio-heading">Campaign workspace</h2>
        </div>
        <span className="workspace-hint">Choose a step above to continue.</span>
      </div>
      <div className="studio">
        <div className="studio-top">
          <div>
            <b>Neptun campaign</b>
            <span>Changes save automatically on this browser.</span>
          </div>
          <span className="studio-save" id="save-indicator">
            Local workspace
          </span>
        </div>
        <div className="tabs" role="tablist" aria-label="Campaign stages">
          {["Product list", "Image review", "Product details", "Brochure"].map(
            (name, stage) => (
              <button
                role="tab"
                aria-selected={stage === 0}
                data-stage={stage}
                key={name}
              >
                0{stage + 1} <span>{name}</span>
              </button>
            ),
          )}
        </div>
        <div id="workspace" />
        <div className="studio-foot">
          <span id="status" role="status" aria-live="polite" />
          <span>NEPTUN KOSOVO</span>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  useEffect(() => {
    let active = true;
    (async () => {
      await import("./language");
      await import("./signin");
      await import("./cutout");
      const { mountWorkspace } = await import("./workspace");
      if (active) mountWorkspace();
    })().catch((error) => {
      console.error("Neptun workspace failed to start", error);
      const status = document.getElementById("status");
      if (status)
        status.textContent =
          "Workspace could not start. Check the browser console.";
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <SignIn />
      <Header />
      <main className="app-main">
        <section className="dashboard-intro">
          <div>
            <div className="eyebrow">NEPTUN KOSOVO · CAMPAIGN WORKSPACE</div>
            <h1>Campaigns</h1>
            <p>Open a saved campaign or start a new one.</p>
          </div>
          <div className="workspace-mark">
            <span>NEPTUN</span>
            <small>Campaign studio</small>
          </div>
        </section>
        <section
          id="campaigns"
          className="campaigns-section"
          aria-labelledby="campaigns-heading"
        >
          <div id="library" className="brochure-library" />
        </section>
        <Workflow />
        <Workspace />
      </main>
      <footer className="app-footer">
        <span className="brand-symbol" aria-hidden="true">
          ▥
        </span>
        <span>Neptun campaign workspace</span>
        <span>
          © 2026 <strong>BrochurePlatform</strong>.{" "}
          <span>All rights reserved.</span>
        </span>
      </footer>
    </>
  );
}
