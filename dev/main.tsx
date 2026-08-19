import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { EasterEggArcade, useLogoEasterEgg } from "@easter-egg/index";
import "./index.css";

/**
 * A stand-in host application: one bar, one logo, nothing else.
 *
 * The point is to exercise the arcade exactly the way a real app does — six
 * clicks on a logo that also does something of its own — without needing that
 * app around. `npm run dev`.
 */
const LANGUAGES = ["en", "de", "es", "fr", "ar"] as const;

const Playground = () => {
  const { arcadeOpen, closeArcade, registerLogoClick } = useLogoEasterEgg();
  const [language, setLanguage] = useState<string>("en");
  const [navigations, setNavigations] = useState(0);

  return (
    <div className="flex min-h-full flex-col bg-slate-950 text-slate-200">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <button
          type="button"
          onClick={() => {
            registerLogoClick();
            // Whatever the real logo already did stays as it was.
            setNavigations((count) => count + 1);
          }}
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-lg font-black tracking-tight text-white transition hover:opacity-80"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-fuchsia-500 text-[13px] text-white">
            ▶
          </span>
          Host App
        </button>

        <label className="flex items-center gap-2 text-sm text-slate-400">
          Language
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-slate-100"
          >
            {LANGUAGES.map((code) => (
              <option key={code} value={code} className="bg-slate-900">
                {code}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <p className="text-2xl font-semibold text-white">Click the logo six times.</p>
        <p className="max-w-md text-sm text-slate-400">
          Clicks must land within 1.2 seconds of each other. The arcade chunk starts
          downloading on the third, so the modal opens without a wait.
        </p>
        <p className="text-xs text-slate-600">
          Logo clicks handled by the host: {navigations}
        </p>
      </main>

      <EasterEggArcade open={arcadeOpen} onClose={closeArcade} language={language} />
    </div>
  );
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
