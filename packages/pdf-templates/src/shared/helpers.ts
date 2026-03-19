import Handlebars from "handlebars";

/**
 * Register all custom Handlebars helpers for PDF templates.
 * Australian formatting conventions applied.
 */
export function registerHelpers(): void {
  Handlebars.registerHelper(
    "formatDate",
    (date: string | Date): string => {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    },
  );

  Handlebars.registerHelper(
    "formatDateTime",
    (date: string | Date): string => {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    },
  );

  Handlebars.registerHelper(
    "formatTime",
    (date: string | Date): string => {
      const d = new Date(date);
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    },
  );

  Handlebars.registerHelper(
    "formatCurrency",
    (amount: number): string => {
      return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    },
  );

  Handlebars.registerHelper(
    "yesNo",
    (value: boolean): string => {
      return value ? "Yes" : "No";
    },
  );

  Handlebars.registerHelper(
    "formatAbn",
    (abn: string): string => {
      if (!abn || abn.length !== 11) return abn ?? "";
      return `${abn.slice(0, 2)} ${abn.slice(2, 5)} ${abn.slice(5, 8)} ${abn.slice(8, 11)}`;
    },
  );

  Handlebars.registerHelper(
    "ifEquals",
    function (
      this: unknown,
      a: unknown,
      b: unknown,
      options: Handlebars.HelperOptions,
    ): string {
      return a === b
        ? options.fn(this)
        : options.inverse(this);
    },
  );
}
