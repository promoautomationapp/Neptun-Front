import "../styles/promo-automation-credit.css";

export function PromoAutomationCredit({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`pa-powered-by ${className}`} data-export-hide="true">
      <span className="pa-powered-by-logo" aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}branding/promo-automation-logo.png`}
          alt=""
          width="1254"
          height="1254"
        />
      </span>
      <span className="pa-powered-by-copy">
        <span>Powered by</span>
        <strong>Promo Automation</strong>
      </span>
    </div>
  );
}
