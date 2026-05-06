import { NextResponse } from 'next/server'

export async function GET() {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ever Spark Tech — Leave Request Form</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a2010; padding: 40px; max-width: 700px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 3px solid #1b4332; padding-bottom: 20px; margin-bottom: 30px; }
    .logo-text { font-size: 28px; font-weight: 800; color: #1b4332; letter-spacing: -0.5px; }
    .logo-sub { font-size: 11px; color: #666; letter-spacing: 3px; text-transform: uppercase; margin-top: 2px; }
    h1 { font-size: 18px; font-weight: 700; color: #1b4332; margin-top: 12px; letter-spacing: 1px; text-transform: uppercase; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 11px; font-weight: 700; color: #1b4332; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 12px; }
    .field { margin-bottom: 12px; }
    .label { font-size: 11px; font-weight: 600; color: #4a6830; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .line { border-bottom: 1px solid #333; min-height: 28px; padding-bottom: 3px; }
    .leave-types { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
    .leave-type { display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .box { width: 14px; height: 14px; border: 1.5px solid #333; display: inline-block; flex-shrink: 0; }
    .signature-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
    .sig-line { border-bottom: 1px solid #333; height: 40px; margin-bottom: 4px; }
    .sig-label { font-size: 11px; color: #666; }
    .note { background: #f0f9f5; border: 1px solid #c8e6d0; border-radius: 6px; padding: 12px 16px; font-size: 12px; color: #2d5a47; margin-top: 20px; }
    .footer { text-align: center; font-size: 10px; color: #999; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>

  <div class="header">
    <div class="logo-text">everspark</div>
    <div class="logo-sub">Technologies</div>
    <h1>Leave Request Form</h1>
  </div>

  <!-- Employee Details -->
  <div class="section">
    <div class="section-title">Employee Information</div>
    <div class="field-row">
      <div class="field"><div class="label">Full Name</div><div class="line"></div></div>
      <div class="field"><div class="label">Employee ID / Role</div><div class="line"></div></div>
    </div>
    <div class="field-row">
      <div class="field"><div class="label">Department</div><div class="line"></div></div>
      <div class="field"><div class="label">Date of Request</div><div class="line">${today}</div></div>
    </div>
  </div>

  <!-- Leave Details -->
  <div class="section">
    <div class="section-title">Leave Details</div>
    <div class="field-row">
      <div class="field"><div class="label">Start Date</div><div class="line"></div></div>
      <div class="field"><div class="label">End Date</div><div class="line"></div></div>
    </div>
    <div class="field-row">
      <div class="field"><div class="label">Number of Working Days</div><div class="line"></div></div>
      <div class="field"><div class="label">Remaining Balance (days)</div><div class="line"></div></div>
    </div>
    <div class="field" style="margin-top: 8px;">
      <div class="label">Type of Leave</div>
      <div class="leave-types" style="margin-top: 10px;">
        <div class="leave-type"><span class="box"></span> Annual</div>
        <div class="leave-type"><span class="box"></span> Sick</div>
        <div class="leave-type"><span class="box"></span> Emergency</div>
        <div class="leave-type"><span class="box"></span> Maternity</div>
        <div class="leave-type"><span class="box"></span> Paternity</div>
        <div class="leave-type"><span class="box"></span> Unpaid</div>
      </div>
    </div>
  </div>

  <!-- Reason -->
  <div class="section">
    <div class="section-title">Reason / Notes</div>
    <div style="border: 1px solid #333; min-height: 80px; padding: 8px; border-radius: 4px;"></div>
  </div>

  <!-- Signatures -->
  <div class="signature-row">
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Employee Signature &amp; Date</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Manager / Admin Approval &amp; Date</div>
    </div>
  </div>

  <div class="note">
    <strong>Instructions:</strong> Complete all fields and submit to your administrator at least 3 working days before the requested leave date.
    For emergencies, notify your manager as soon as possible.
  </div>

  <div class="footer">
    Ever Spark Technologies &nbsp;·&nbsp; HR Department &nbsp;·&nbsp; Confidential
  </div>

  <div class="no-print" style="text-align:center; margin-top: 30px;">
    <button onclick="window.print()" style="background:#1b4332;color:white;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;">
      Print / Save as PDF
    </button>
  </div>

</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': 'inline; filename="EverSpark-Leave-Request-Form.html"',
    },
  })
}
