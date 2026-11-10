import React from "react";
import {
  RedReferencePrice,
  RedReferenceSavings,
  type RedReferencePriceProps,
  type RedReferenceSavingsProps,
} from "./RedReferencePrice";
import "../../styles/black-friday-fonts.css";

/** The Black Friday print artwork uses the familiar orange price and a charcoal
 * installment strip. Its outer frame is identical, so saved editor handles and
 * every product's price visibility/size/movement behavior continue to apply. */
export function BlackFridayPrice(
  props: Omit<RedReferencePriceProps, "variant">,
) {
  return <RedReferencePrice {...props} variant="black-friday" />;
}

/** Uses the full source circle frame, regular label and bold amount in black. */
export function BlackFridaySavings(
  props: Omit<RedReferenceSavingsProps, "variant">,
) {
  return <RedReferenceSavings {...props} variant="black-friday" />;
}
