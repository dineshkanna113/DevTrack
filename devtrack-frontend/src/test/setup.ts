import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom doesn't implement <dialog> modality; emulate the open attribute.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});
