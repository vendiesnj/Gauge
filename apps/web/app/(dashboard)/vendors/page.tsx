import { VENDORS } from "@api-spend/shared";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Vendor catalog" };

const CATEGORY_ORDER = ["ai", "payments", "email", "sms", "auth", "cloud", "cdn", "monitoring", "search", "other"];

export default function VendorCatalogPage() {
  const byCategory = CATEGORY_ORDER.reduce<Record<string, typeof VENDORS>>((acc, cat) => {
    const vendors = VENDORS.filter((v) => v.category === cat);
    if (vendors.length > 0) acc[cat] = vendors;
    return acc;
  }, {});

  return (
    <div className="page-body">
      <div style={{ marginBottom: 28 }}>
        <h1 className="heading-lg">Vendor catalog</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          {VENDORS.length} vendors supported for detection. Gauge matches imports, env vars, domains, API key patterns, and package dependencies.
        </p>
      </div>

      {Object.entries(byCategory).map(([category, vendors]) => (
        <div key={category} style={{ marginBottom: 28 }}>
          <div className="row gap-8" style={{ marginBottom: 12 }}>
            <span className={`badge badge-${category}`} style={{ textTransform: "capitalize" }}>{category}</span>
            <span className="muted small">{vendors.length} vendor{vendors.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="grid-2">
            {vendors.map((v) => (
              <div key={v.id} className="card card-sm" style={{ padding: 16 }}>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                  <div className="heading-sm">{v.name}</div>
                  <span className="badge badge-low" style={{ fontSize: 10 }}>
                    {v.pricingModel.replace(/_/g, " ")}
                  </span>
                </div>

                {v.cheaperAlternativeHeadline && (
                  <p className="muted small" style={{ marginBottom: 8 }}>{v.cheaperAlternativeHeadline}</p>
                )}

                <div className="stack gap-4">
                  {v.domains.length > 0 && (
                    <div className="row gap-4" style={{ flexWrap: "wrap" }}>
                      {v.domains.slice(0, 3).map((d) => (
                        <code key={d} style={{ fontSize: 11, background: "var(--bg)", padding: "2px 6px", borderRadius: 4 }}>{d}</code>
                      ))}
                    </div>
                  )}

                  {v.envVars.length > 0 && (
                    <div className="row gap-4" style={{ flexWrap: "wrap" }}>
                      {v.envVars.slice(0, 3).map((e) => (
                        <span key={e} className="badge badge-medium" style={{ fontSize: 10 }}>{e}</span>
                      ))}
                    </div>
                  )}
                </div>

                {v.alternatives.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div className="muted small" style={{ marginBottom: 4 }}>Alternatives:</div>
                    <div className="row gap-4" style={{ flexWrap: "wrap" }}>
                      {v.alternatives.map((alt) => (
                        <span key={alt.vendorId} className="badge badge-high" style={{ fontSize: 10 }}>
                          {alt.vendorId}
                          {alt.estimatedSavingsPct && ` −${alt.estimatedSavingsPct}%`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="row gap-6" style={{ marginTop: 10 }}>
                  {v.planDiscovery.canOAuth && (
                    <span className="badge badge-accent" style={{ fontSize: 10 }}>OAuth billing</span>
                  )}
                  <span className="muted small">{v.planDiscovery.notes}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
