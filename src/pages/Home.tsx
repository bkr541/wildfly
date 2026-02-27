<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Flight Cards</title>
    <style>
      :root{
        /* Core surfaces */
        --bg: #F9FBFA;          /* page */
        --accentPanel: #C9DED6; /* pale mint */

        /* Chart + accents */
        --gold: #E5AA3A;
        --ink: #1A2321;         /* primary text + segment */
        --teal: #4C8984;
        --tealLite: #AEC7C4;

        /* Neutrals */
        --mid: #9DA3A2;
        --dark: #5C6361;

        /* Deep greens for shadows */
        --shadow1: rgba(38, 68, 57, 0.10); /* #264439 */
        --shadow2: rgba(54, 82, 73, 0.12); /* #365249 */
      }

      *{ box-sizing:border-box; }
      body{
        margin:0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        background: var(--bg);
        color: var(--ink);
      }

      .wrap{
        max-width: 420px;
        margin: 28px auto;
        padding: 0 16px 28px;
        display: grid;
        gap: 14px;
      }

      .card{
        position: relative;
        border-radius: 18px;
        background: #FFFFFF;
        box-shadow: 0 14px 40px var(--shadow1), 0 4px 14px var(--shadow2);
        overflow: hidden;
      }

      .card::before{
        content:"";
        position:absolute;
        inset: 0 auto 0 0;
        width: 14px;
        background: var(--accentPanel);
      }

      .inner{
        padding: 16px 16px 16px 20px;
        margin-left: 0;
      }

      .header{
        display:flex;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
      }

      .title{
        display:flex;
        flex-direction: column;
        gap: 3px;
      }

      .kicker{
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--dark);
      }

      .hline{
        display:flex;
        align-items:center;
        gap: 10px;
      }

      .h1{
        font-size: 18px;
        font-weight: 800;
        line-height: 1.1;
        margin:0;
      }

      .sub{
        font-size: 12.5px;
        color: var(--mid);
        margin:0;
      }

      .pill{
        display:inline-flex;
        align-items:center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 999px;
        background: rgba(174, 199, 196, 0.35); /* tealLite tint */
        border: 1px solid rgba(174, 199, 196, 0.55);
        color: var(--ink);
        font-weight: 700;
        font-size: 12.5px;
        white-space: nowrap;
      }

      .dot{
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: var(--gold);
        box-shadow: 0 0 0 3px rgba(229, 170, 58, 0.20);
        flex: 0 0 auto;
      }

      /* Upcoming Flight layout */
      .route{
        display:flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 14px;
        padding: 14px 14px;
        border-radius: 14px;
        background: rgba(201, 222, 214, 0.28); /* accentPanel tint */
        border: 1px solid rgba(174, 199, 196, 0.55);
      }

      .iata{
        display:flex;
        flex-direction: column;
        gap: 4px;
        min-width: 92px;
      }
      .iata strong{
        font-size: 22px;
        letter-spacing: 0.06em;
      }
      .iata span{
        font-size: 12.5px;
        color: var(--dark);
      }

      .midline{
        display:flex;
        flex-direction: column;
        align-items:center;
        gap: 8px;
        flex: 1;
        padding: 0 10px;
      }

      .line{
        width: 100%;
        height: 2px;
        background: rgba(92, 99, 97, 0.22);
        position: relative;
        border-radius: 999px;
      }
      .plane{
        position:absolute;
        left:50%;
        top:50%;
        transform: translate(-50%, -50%);
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: #FFFFFF;
        border: 1px solid rgba(174, 199, 196, 0.85);
        box-shadow: 0 10px 20px rgba(38, 68, 57, 0.10);
        display:grid;
        place-items:center;
      }
      .plane svg{ width: 16px; height: 16px; color: var(--teal); }

      .metaGrid{
        margin-top: 14px;
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 12px;
      }

      .meta{
        border-radius: 14px;
        padding: 10px 12px;
        border: 1px solid rgba(174, 199, 196, 0.45);
        background: rgba(249, 251, 250, 0.65);
      }
      .meta label{
        display:block;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--mid);
        margin-bottom: 6px;
      }
      .meta div{
        font-weight: 800;
        color: var(--ink);
        font-size: 13.5px;
      }
      .meta small{
        display:block;
        margin-top: 3px;
        color: var(--dark);
        font-size: 12px;
        font-weight: 650;
      }

      /* Airline Risk */
      .riskWrap{
        margin-top: 14px;
        padding: 12px 12px;
        border-radius: 14px;
        border: 1px solid rgba(174, 199, 196, 0.55);
        background: rgba(201, 222, 214, 0.20);
      }

      .segBar{
        width: 100%;
        height: 12px;
        border-radius: 999px;
        overflow:hidden;
        background: rgba(92, 99, 97, 0.18);
        display:flex;
      }
      .seg{ height: 100%; }
      .seg.onTime{ background: var(--tealLite); width: 54%; }
      .seg.minor{ background: var(--teal); width: 28%; }
      .seg.major{ background: var(--gold); width: 13%; }
      .seg.cancel{ background: var(--ink); width: 5%; }

      .legend{
        margin-top: 10px;
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 10px;
      }

      .legItem{
        display:flex;
        align-items:center;
        gap: 8px;
        font-size: 12.5px;
        color: var(--dark);
        font-weight: 650;
      }
      .swatch{
        width: 10px;
        height: 10px;
        border-radius: 3px;
        border: 1px solid rgba(26, 35, 33, 0.08);
      }

      .drivers{
        margin-top: 12px;
        display:flex;
        flex-direction: column;
        gap: 8px;
      }
      .driver{
        display:flex;
        align-items:flex-start;
        gap: 10px;
        padding: 10px 10px;
        border-radius: 12px;
        background: rgba(255,255,255,0.72);
        border: 1px solid rgba(174, 199, 196, 0.45);
      }
      .driver p{
        margin:0;
        font-size: 12.5px;
        color: var(--dark);
        font-weight: 650;
        line-height: 1.25;
      }
      .driver p b{ color: var(--ink); }

      /* Optional: tiny “ticket notch” vibe */
      .ticketCuts{
        position:absolute;
        left: 14px; right: 0;
        top: 58px;
        height: 0;
        pointer-events:none;
      }
      .ticketCuts:before,
      .ticketCuts:after{
        content:"";
        position:absolute;
        top: -8px;
        width: 16px; height: 16px;
        border-radius: 999px;
        background: var(--bg);
        box-shadow: inset 0 0 0 1px rgba(174, 199, 196, 0.55);
      }
      .ticketCuts:before{ left: -8px; }
      .ticketCuts:after{ right: -8px; }
    </style>
  </head>

  <body>
    <div class="wrap">

      <!-- Upcoming Flight -->
      <section class="card">
        <div class="inner">
          <div class="header">
            <div class="title">
              <div class="kicker">Upcoming Flight</div>
              <div class="hline">
                <h2 class="h1">Atlanta to Chicago</h2>
              </div>
              <p class="sub">Thu, Feb 26 • Departs 6:10 AM • Arrives 7:40 AM</p>
            </div>

            <div class="pill">
              <span class="dot"></span>
              On schedule
            </div>
          </div>

          <div class="ticketCuts"></div>

          <div class="route">
            <div class="iata">
              <strong>ATL</strong>
              <span>Hartsfield-Jackson</span>
            </div>

            <div class="midline">
              <div class="line">
                <div class="plane" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M2.5 13.2l19-6.8c.6-.2 1.2.4 1 .9l-2.4 5.6c-.1.3-.4.5-.7.6l-6 1.4-2.2 6.1c-.2.6-1 .7-1.3.2l-2.7-4-4.2-1.7c-.6-.2-.7-1.1-.1-1.3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                  </svg>
                </div>
              </div>
              <div class="sub" style="margin:0; color: var(--mid); font-size:12px;">
                Nonstop • 1h 30m
              </div>
            </div>

            <div class="iata" style="text-align:right;">
              <strong>ORD</strong>
              <span>O'Hare Intl</span>
            </div>
          </div>

          <div class="metaGrid">
            <div class="meta">
              <label>Airline</label>
              <div>Frontier</div>
              <small>F9 1234</small>
            </div>
            <div class="meta">
              <label>Aircraft</label>
              <div>A320</div>
              <small>Boarding T-30</small>
            </div>
            <div class="meta">
              <label>Terminal / Gate</label>
              <div>T-N • G12</div>
              <small>Check screens</small>
            </div>
            <div class="meta">
              <label>Seat</label>
              <div>14A</div>
              <small>Carry-on: 1</small>
            </div>
          </div>
        </div>
      </section>

      <!-- Airline Risk -->
      <section class="card">
        <div class="inner">
          <div class="header">
            <div class="title">
              <div class="kicker">Airline Risk</div>
              <div class="hline">
                <h2 class="h1">Reliability profile</h2>
              </div>
              <p class="sub">Based on recent performance patterns for your route and time window</p>
            </div>

            <div class="pill" title="Overall risk score">
              <span class="dot"></span>
              Risk: Medium
            </div>
          </div>

          <div class="riskWrap">
            <div class="sub" style="margin:0 0 8px 0; color: var(--dark); font-weight: 750;">
              Outcome mix
            </div>

            <div class="segBar" aria-label="Outcome mix bar">
              <div class="seg onTime" title="On-time"></div>
              <div class="seg minor" title="Minor delay"></div>
              <div class="seg major" title="Major delay"></div>
              <div class="seg cancel" title="Cancellation"></div>
            </div>

            <div class="legend">
              <div class="legItem"><span class="swatch" style="background: var(--tealLite);"></span>On-time (54%)</div>
              <div class="legItem"><span class="swatch" style="background: var(--teal);"></span>Minor delay (28%)</div>
              <div class="legItem"><span class="swatch" style="background: var(--gold);"></span>Major delay (13%)</div>
              <div class="legItem"><span class="swatch" style="background: var(--ink);"></span>Cancellation (5%)</div>
            </div>

            <div class="drivers">
              <div class="driver">
                <span class="dot" aria-hidden="true"></span>
                <p><b>Primary driver:</b> morning gate congestion tends to amplify small delays.</p>
              </div>
              <div class="driver">
                <span class="dot" aria-hidden="true"></span>
                <p><b>Secondary driver:</b> tight turnarounds can convert a late inbound into a late outbound.</p>
              </div>
              <div class="driver">
                <span class="dot" aria-hidden="true"></span>
                <p><b>Watch item:</b> weather sensitivity on your departure corridor.</p>
              </div>
            </div>
          </div>

          <p class="sub" style="margin-top: 12px;">
            Tip: if you need a safer buffer, target flights with earlier departures and longer layover slack.
          </p>
        </div>
      </section>

    </div>
  </body>
</html>