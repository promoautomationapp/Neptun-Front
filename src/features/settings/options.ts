const asset = (name: string) => `/api/assets/legacy/assets/${name}`;
export const COVER_OPTIONS = [
  {
    id: "blueClean",
    label: "NEPTUN blue (default)",
    image: "/cover-backgrounds/blue-clean.svg",
  },
  {
    id: "redBlue",
    label: "Orange top / blue",
    image: "/cover-backgrounds/red-blue.svg",
  },
] as const;
export const LOGO_ROLES = [
  {
    id: "neptun",
    label: "NEPTUN logo inside the brochure",
    image: "/api/assets/app/logo",
  },
  {
    id: "coverBand",
    label: "UUU / hajde! cover band",
    image: asset("uuu-hajde-band.png"),
  },
  {
    id: "bestbuy",
    label: "BestBuy award",
    image: asset("bestbuy-qudal-badges.png"),
  },
  {
    id: "qudal",
    label: "QUDAL award",
    image: asset("bestbuy-qudal-badges.png"),
  },
  {
    id: "service",
    label: "Elektro-Servis logo",
    image: asset("elektro-servis-kosova.png"),
  },
  {
    id: "balfin",
    label: "BALFIN Group logo",
    image: asset("part-of-balfin-group.png"),
  },
  {
    id: "storesHajde",
    label: "Stores page hajde! logo",
    image: asset("stores-hajde-logo.png"),
  },
] as const;
export const ICON_ROLES = [
  { id: "wifi", label: "WiFi", image: asset("product-badges/wifi.svg") },
  {
    id: "inverter",
    label: "Inverter",
    image: asset("product-badges/inverter.svg"),
  },
  {
    id: "energy-a-plus-plus",
    label: "Energy A++",
    image: asset("product-badges/energy-a-plus-plus.svg"),
  },
  {
    id: "energy-a-plus-plus-plus",
    label: "Energy A+++",
    image: asset("product-badges/energy-a-plus-plus-plus.svg"),
  },
  { id: "storePin", label: "Store location pin", image: "" },
  { id: "onlineCart", label: "Online shopping cart", image: "" },
  { id: "email", label: "Email", image: "" },
  { id: "website", label: "Website", image: "" },
  { id: "facebook", label: "Facebook", image: "" },
  { id: "instagram", label: "Instagram", image: "" },
] as const;
export const STORE_ELEMENTS = [
  { id: "heading", label: "DYQANET heading" },
  { id: "hajde", label: "hajde! logo" },
  { id: "awards", label: "Awards" },
  { id: "locations", label: "Store locations" },
  { id: "disclaimer", label: "Terms and membership note" },
  { id: "service", label: "Service information" },
  { id: "balfin", label: "BALFIN logo" },
  { id: "social", label: "Contact and social links" },
] as const;
export const FOOTER_ELEMENTS = [
  { id: "disclaimer", label: "Terms" },
  { id: "brand", label: "NEPTUN and BALFIN" },
  { id: "stores", label: "Store locations" },
  { id: "service", label: "Service information" },
] as const;
export const CONTACT_LABELS: Record<string, string> = {
  email: "Email",
  website: "Website",
  facebook: "Facebook",
  instagram: "Instagram",
  onlineEmail: "Online store email",
  onlinePhone: "Online store phone",
  serviceAddress: "Service address",
  servicePhones: "Service phones",
  group: "Group name",
  disclaimer: "Brochure terms",
  membershipDisclaimer: "Membership terms",
  discountDisclaimer: "Discount terms",
};
