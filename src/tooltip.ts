import { CdxTooltip } from "@wikimedia/codex";
import type { DirectiveBinding, ObjectDirective } from "vue";

interface Tooltip {
  show(): void;
  remove(): void;
  isVisible(): boolean;
  updateWithOptions(options: { textContent: string }): void;
}
type Element = HTMLElement & {
  tooltip?: Tooltip;
  tooltipText?: string;
  tooltipListeners?: [string, () => void][];
  tooltipTimer?: ReturnType<typeof setTimeout>;
};

/** the pointer has to rest this long before a tooltip appears */
const HOVER_DELAY = 500;

/**
 * Codex tooltip directive, created on focus or once the pointer rests on the
 * element for {@link HOVER_DELAY}, and removed once hidden: Codex creates
 * every tooltip eagerly, each with a DOM node and floating-ui `autoUpdate`
 * (scroll/resize listeners), which adds up to thousands for large items.
 */
export const lazyTooltip: ObjectDirective<Element, string> = {
  mounted(el, binding) {
    el.tooltipText = binding.value;
    const create = () => {
      if (el.tooltip || !el.tooltipText?.trim()) return;
      (CdxTooltip as ObjectDirective).mounted!(
        el,
        { ...binding, value: el.tooltipText } as DirectiveBinding,
        null!,
        null,
      );
      // registered after this event fired: show it now
      (el.tooltip as Tooltip | undefined)?.show();
    };
    // restarted on every move, so the tooltip appears once the pointer rests
    const hover = () => {
      if (el.tooltip) return;
      clearTimeout(el.tooltipTimer);
      el.tooltipTimer = setTimeout(create, HOVER_DELAY);
    };
    const destroy = () => {
      clearTimeout(el.tooltipTimer);
      // after Codex' hide delay (250 ms), unless shown again
      setTimeout(() => {
        if (!el.tooltip || el.tooltip.isVisible()) return;
        el.tooltip.remove();
        el.tooltip = undefined;
        el.removeAttribute("aria-describedby");
      }, 300);
    };
    el.tooltipListeners = [
      ["mouseenter", hover],
      ["mousemove", hover],
      ["focus", create],
      ["mouseleave", destroy],
      ["blur", destroy],
    ];
    for (const [type, listener] of el.tooltipListeners)
      el.addEventListener(type, listener);
  },
  updated(el, binding) {
    el.tooltipText = binding.value;
    el.tooltip?.updateWithOptions({ textContent: binding.value });
  },
  beforeUnmount(el) {
    clearTimeout(el.tooltipTimer);
    for (const [type, listener] of el.tooltipListeners ?? [])
      el.removeEventListener(type, listener);
    el.tooltip?.remove();
  },
};
