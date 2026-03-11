/**
 * Instant Takeoff section — replaces "Everything You Need".
 * Left: copy (eyebrow, headline, body, stats, CTA). Right: tilted takeoff UI mock.
 */
import { Link } from 'react-router-dom'

const TAKEOFF_ROWS = [
  { name: "2×6 Framing Lumber, 16' lengths", sub: 'Douglas Fir — Grade #2 or better', qty: '284', unit: 'pcs', cost: '$14.20', conf: 96, confHigh: true },
  { name: 'LVL Beam 3.5×9.5, 20\' span', sub: 'Laminated Veneer Lumber', qty: '12', unit: 'pcs', cost: '$218.00', conf: 91, confHigh: true },
  { name: 'OSB Sheathing 7/16", 4×8 sheets', sub: 'Oriented Strand Board', qty: '148', unit: 'sheets', cost: '$22.50', conf: 98, confHigh: true },
  { name: "2×4 Interior Partition Studs, 8'", sub: 'Spruce-Pine-Fir', qty: '412', unit: 'pcs', cost: '$6.80', conf: 94, confHigh: true },
  { name: 'Rim Board 1-1/4"×9-1/2"', sub: 'Engineered Lumber', qty: '86', unit: 'LF', cost: '$4.40', conf: 78, confHigh: false },
  { name: 'Hurricane Ties H2.5A', sub: 'Simpson Strong-Tie', qty: '568', unit: 'ea', cost: '$0.88', conf: 99, confHigh: true },
  { name: 'Joist Hanger LUS26', sub: 'Simpson Strong-Tie', qty: '204', unit: 'ea', cost: '$1.65', conf: 95, confHigh: true },
]

const CATEGORIES = [
  { name: 'Lumber & Framing', count: 14, active: true },
  { name: 'Concrete & Masonry', count: 8, active: false },
  { name: 'Electrical', count: 22, active: false },
  { name: 'Plumbing', count: 11, active: false },
  { name: 'Roofing', count: 6, active: false },
  { name: 'Doors & Windows', count: 9, active: false },
  { name: 'Drywall & Finishing', count: 7, active: false },
  { name: 'Hardware & Fasteners', count: 18, active: false },
  { name: 'HVAC', count: 5, active: false },
]

export function InstantTakeoffSection() {
  return (
    <section id="features" className="takeoff-section w-full min-h-screen flex items-center relative overflow-hidden">
      {/* Dot grid fading right */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          backgroundImage: 'radial-gradient(rgba(245,243,239,.055) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to right, black 0%, black 25%, transparent 60%)',
          WebkitMaskImage: 'linear-gradient(to right, black 0%, black 25%, transparent 60%)',
        }}
        aria-hidden
      />
      {/* Ambient glows */}
      <div
        className="absolute top-1/2 right-0 w-[900px] h-[900px] pointer-events-none z-[1] -translate-y-1/2"
        style={{ background: 'radial-gradient(rgba(192,57,43,.1) 0%, transparent 60%)' }}
        aria-hidden
      />
      <div
        className="absolute top-[40%] left-[-5%] w-[500px] h-[500px] pointer-events-none z-[1]"
        style={{ background: 'radial-gradient(rgba(192,57,43,.07) 0%, transparent 60%)' }}
        aria-hidden
      />

      {/* Background UI — tilted takeoff mock */}
      <div className="takeoff-section-bg-ui">
        <div className="takeoff-section-bg-fade" aria-hidden />
        <div className="takeoff-section-ui">
          <div className="takeoff-section-topbar">
            <span className="takeoff-section-dot takeoff-section-dot-r" />
            <span className="takeoff-section-dot takeoff-section-dot-y" />
            <span className="takeoff-section-dot takeoff-section-dot-g" />
            <div className="takeoff-section-title">Riverside Commercial — Floor 4 · Material Takeoff</div>
          </div>
          <div className="takeoff-section-tabs">
            <div className="takeoff-section-tab takeoff-section-tab-active">Takeoff</div>
            <div className="takeoff-section-tab">Bid Sheet</div>
            <div className="takeoff-section-tab">Sub Bids</div>
            <div className="takeoff-section-tab">Notes</div>
            <div className="takeoff-section-tab">History</div>
            <div className="flex-1" />
          </div>
          <div className="takeoff-section-body">
            <div className="takeoff-section-cats">
              <div className="takeoff-section-cats-title">Categories</div>
              {CATEGORIES.map((cat) => (
                <div key={cat.name} className={`takeoff-section-cat-item ${cat.active ? 'takeoff-section-cat-active' : ''}`}>
                  <span className="takeoff-section-cat-name">{cat.name}</span>
                  <span className="takeoff-section-cat-count">{cat.count}</span>
                </div>
              ))}
            </div>
            <div className="takeoff-section-table-wrap">
              <div className="takeoff-section-table-header">
                <div>
                  <div className="takeoff-section-table-title">Lumber & Framing</div>
                  <div className="takeoff-section-table-sub">14 line items · auto-calculated from plans</div>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" className="takeoff-section-btn">Export CSV</button>
                  <button type="button" className="takeoff-section-btn">Edit</button>
                  <button type="button" className="takeoff-section-btn takeoff-section-btn-red">→ Build Bid Sheet</button>
                </div>
              </div>
              <div className="takeoff-section-col-heads">
                <div className="takeoff-section-col-head">Material</div>
                <div className="takeoff-section-col-head">Qty</div>
                <div className="takeoff-section-col-head">Unit</div>
                <div className="takeoff-section-col-head takeoff-section-col-head-right">Unit Cost</div>
                <div className="takeoff-section-col-head takeoff-section-col-head-right">Confidence</div>
              </div>
              <div className="takeoff-section-rows">
                {TAKEOFF_ROWS.map((row) => (
                  <div key={row.name} className="takeoff-section-row">
                    <div>
                      <div className="takeoff-section-row-name">{row.name}</div>
                      <div className="takeoff-section-row-sub">{row.sub}</div>
                    </div>
                    <div className="takeoff-section-row-cell">{row.qty}</div>
                    <div className="takeoff-section-row-cell">{row.unit}</div>
                    <div className="takeoff-section-row-cost">{row.cost}</div>
                    <div className="takeoff-section-row-conf">
                      <div className="takeoff-section-conf-bar">
                        <div
                          className={`takeoff-section-conf-fill ${row.confHigh ? 'takeoff-section-conf-high' : 'takeoff-section-conf-med'}`}
                          style={{ width: `${row.conf}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="takeoff-section-footer">
                <div className="flex gap-6">
                  <div className="takeoff-section-footer-stat">14 items</div>
                  <div className="takeoff-section-footer-stat">Avg confidence: <strong>93%</strong></div>
                  <div className="takeoff-section-footer-stat">AI model: <strong>Proj-X v2</strong></div>
                </div>
                <div className="takeoff-section-footer-total">Category subtotal: <span>$28,440</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Copy — left */}
      <div className="takeoff-section-copy">
        <div className="takeoff-section-eyebrow">
          <span className="takeoff-section-eyebrow-dot" />
          Instant Takeoffs
        </div>
        <h2 className="takeoff-section-hero-head">
          Upload Plans.<br />
          Get Your List<br />
          in <em>Minutes.</em>
        </h2>
        <p className="takeoff-section-copy-body">
          Proj-X reads your blueprints and generates a complete, itemized material list automatically. No more days lost to manual counting. No more costly estimate errors. Just accurate takeoffs, fast.
        </p>
        <div className="takeoff-section-stats-row">
          <div className="takeoff-section-stat">
            <span className="takeoff-section-stat-num">94%</span>
            <span className="takeoff-section-stat-lbl">Accuracy rate</span>
          </div>
          <div className="takeoff-section-stat-divider" />
          <div className="takeoff-section-stat">
            <span className="takeoff-section-stat-num">2 hrs</span>
            <span className="takeoff-section-stat-lbl">Saved per estimate</span>
          </div>
          <div className="takeoff-section-stat-divider" />
          <div className="takeoff-section-stat">
            <span className="takeoff-section-stat-num">10K+</span>
            <span className="takeoff-section-stat-lbl">Takeoffs processed</span>
          </div>
        </div>
        <div className="takeoff-section-cta-row">
          <Link to="/sign-up" className="takeoff-section-btn-primary">Try It Free →</Link>
          <a href="#features" className="takeoff-section-btn-ghost">Watch how it works ↗</a>
        </div>
      </div>
    </section>
  )
}
