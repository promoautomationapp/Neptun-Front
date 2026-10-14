import { expect, it } from "vitest";
import {
  mobileDetailEntries,
  groupImportedPhoneDetails,
  phoneMemoryAmounts,
} from "../../src/features/brochure/mobileDetails";
import {
  conditionerDetailEntries,
  defaultFilledDetail,
} from "../../src/features/brochure/conditionerDetails";
import { applianceDetailEntries } from "../../src/features/brochure/applianceDetails";
import { savedDetailEntries } from "../../src/features/brochure/detailFacts";

const phone = { name: "Samsung Galaxy A17", subcategory: "SMARTPHONE" };
const conditioner = { name: "FUEGO KONDICIONER", subcategory: "KONDICIONER" };
const washer = { name: "BEKO RROBALARËSE", subcategory: "RROBALARËSE" };

it("reads persisted structured detail rows with stable edit keys and exact saved order", () => {
  const rows = [
    { key: "memory", text: "4GB / 64GB" },
    { key: "camera", text: "Kamera: 13MP Front: 8MP" },
    "Custom detail",
  ];
  const snapshot = { brochureDetails: rows, specs: { OS: "Android 16" } };
  expect(savedDetailEntries(snapshot)).toEqual([
    ["memory", "4GB / 64GB"],
    ["camera", "Kamera: 13MP Front: 8MP"],
    ["2", "Custom detail"],
  ]);
  expect(snapshot.brochureDetails).toBe(rows);
  expect(
    savedDetailEntries({ brochureDetails: [], specs: { OS: "Android 16" } }),
  ).toEqual([]);
});

it("groups explicitly supplied rear/front cameras and storage/RAM in four factual default phone boxes", () => {
  expect(
    mobileDetailEntries({
      ...phone,
      specs: {
        Sistemi: "Android 15",
        Kamera: "50MP",
        "Kamera front": "13MP",
        Storage: "128GB",
        RAM: "4GB",
        Bateria: "Li-Ion 5000mAh",
      },
    }),
  ).toEqual([
    ["Sistemi", "Android 15"],
    ["Kamera", "50MP\nFront: 13MP"],
    ["RAM / Memorje", "4GB / 128GB"],
    ["Bateria", "Li-Ion 5000mAh"],
  ]);
  expect(phoneMemoryAmounts("128GB / 4GB RAM", "Memorje")).toEqual({
    storage: "128GB",
    ram: "4GB",
  });
  expect(phoneMemoryAmounts("128GB / 4GB", "Storage / RAM")).toEqual({
    storage: "128GB",
    ram: "4GB",
  });
});

it("reads factual HTML descriptions, deduplicates cameras, and retains unavailable/fallback facts honestly", () => {
  expect(
    mobileDetailEntries(
      {
        ...phone,
        specs: { Kamera: "13MP", Ngjyra: "Blu" },
        description:
          "* Android 14<br/>* Kamera: 13MP Front: 8MP<br/>* Memorjee brendshme: 64GB, 4GB RAM<br/>* Bateria: 6000mAh",
      },
      { includeFallback: true },
    ),
  ).toEqual([
    ["Sistemi", "Android 14"],
    ["Kamera", "13MP\nFront: 8MP"],
    ["RAM / Memorje", "4GB / 64GB"],
    ["Bateria", "6000mAh"],
    ["Ngjyra", "Blu"],
  ]);
  expect(mobileDetailEntries({ ...phone, specs: { Kamera: "50MP" } })).toEqual([
    ["Kamera", "50MP"],
  ]);
});

it("preserves manually saved detail lists and disabled automatic defaults across product families", () => {
  for (const product of [phone, conditioner, washer]) {
    expect(mobileDetailEntries({ ...product, brochureDetails: [] })).toEqual(
      [],
    );
    expect(
      conditionerDetailEntries({
        ...product,
        brochureDetails: ["Manual one", "Manual two"],
      }),
    ).toEqual([
      ["0", "Manual one"],
      ["1", "Manual two"],
    ]);
    expect(
      applianceDetailEntries({
        ...product,
        autoSpecsDisabled: true,
        specs: { Manual: "8KG" },
        description: "Android 16\nBattery: 5000mAh",
      }),
    ).toEqual([["Manual", "8KG"]]);
  }
  expect(
    mobileDetailEntries({
      ...phone,
      autoSpecsDisabled: true,
      specs: { Camera: "50MP", Front: "13MP" },
    }),
  ).toEqual([
    ["Camera", "50MP"],
    ["Front", "13MP"],
  ]);
});

it("groups only newly imported phone facts while keeping other facts and Apple imports unchanged", () => {
  const lines = [
    "Kamera: 50MP",
    "Front: 13MP",
    "Storage: 128GB",
    "RAM: 8GB",
    "Android 15",
    "Battery: 5000mAh",
    "Bluetooth: v5.4",
  ];
  expect(groupImportedPhoneDetails(phone, lines)).toEqual([
    "Android\n15",
    "KAMERA: 50MP\nFront: 13MP",
    "128GB\n8GB",
    "Bateria:\n5000mAh",
    "Bluetooth: v5.4",
  ]);
  expect(
    groupImportedPhoneDetails(
      { name: "iPhone 17", brand: "Apple", subcategory: "SMARTPHONE" },
      lines,
    ),
  ).toEqual(lines);
  const manual = ["RAM: 8GB", "Manual custom line"];
  const product = { ...phone, brochureDetails: manual };
  groupImportedPhoneDetails(product, lines);
  expect(product.brochureDetails).toBe(manual);
});

it("keeps AC energy pairs and airflow facts together, independent of their supplied spec positions", () => {
  const product = {
    ...conditioner,
    specs: {
      Ngjyra: "White",
      "Klasa energjisë ftohje": "A++",
      "Klasa energjisë ngrohje": "A+",
      BTU: "12000",
      "Niveli operativ": "-20°C deri +53°C",
      Gas: "R32",
    },
    description: "* Qarkullimi i ajrit: 550m&sup3;/h",
  };
  expect(conditionerDetailEntries(product)).toEqual([
    ["BTU", "12000"],
    ["Klasa energjisë", "A++ / A+"],
    ["Niveli operativ", "-20°C deri +53°C"],
    ["GAS", "R32"],
    ["Qarkullimi i ajrit", "550m³/h"],
    ["Ngjyra", "White"],
  ]);
  expect(defaultFilledDetail(product, "Klasa energjisë", "A++ / A+", 3)).toBe(
    true,
  );
  expect(defaultFilledDetail(product, "1", "A++ / A+", 1)).toBe(true);
  expect(
    conditionerDetailEntries({
      ...conditioner,
      specs: { "Klasa energjisë": "A++ / A++" },
    }),
  ).toEqual([["Klasa energjisë", "A++ / A++"]]);
  expect(
    conditionerDetailEntries({
      ...conditioner,
      specs: {
        "Klasa energjisë ftohje": "A++",
        "Klasa energjisë ngrohje": "A++",
      },
    }),
  ).toEqual([["Klasa energjisë", "A++ / A++"]]);
  expect(defaultFilledDetail(product, "Qarkullimi i ajrit", "550m³/h", 0)).toBe(
    false,
  );
});

it("retains separate explicit appliance technologies instead of discarding secondary supplied facts", () => {
  const product = {
    ...washer,
    description:
      "* Kapaciteti: 8KG<br/>* Rrotullime: 1200rpm<br/>* Numri i programeve: 15<br/>* Motori: ProSmart™ Inverter<br/>* Teknologji: EnergySpin",
  };
  expect(applianceDetailEntries(product)).toEqual([
    ["Kapaciteti", "8KG"],
    ["RROTULLIME", "1200"],
    ["PROGRAME", "15"],
    ["Motori", "ProSmart™ Inverter"],
    ["TEKNOLOGJI:", "EnergySpin"],
  ]);
  expect(
    applianceDetailEntries({ ...washer, specs: { Capacity: "8KG" } }),
  ).toEqual([["Kapaciteti", "8KG"]]);
  expect(
    applianceDetailEntries({ ...washer, specs: { Motor: "No inverter" } }),
  ).toEqual([["Motor", "No inverter"]]);
});

it("does not consume an undisplayed second AC technology or invent a temperature range", () => {
  expect(
    conditionerDetailEntries({
      ...conditioner,
      specs: {
        Teknologjia: "Inverter",
        "Technology extra": "SoftWind",
        Temperatura: "-20°C",
      },
    }),
  ).toEqual([
    ["Niveli operativ", "-20°C"],
    ["Teknologjia", "Inverter"],
    ["Technology extra", "SoftWind"],
  ]);
});
