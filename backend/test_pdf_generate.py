from io import BytesIO
from xhtml2pdf import pisa
import fitz # PyMuPDF
import base64

html = """
<html>
<head>
    <style>
        @page {
            size: a4 portrait;
            margin: 20pt 30pt;
        }
        body {
            font-family: Helvetica, sans-serif;
            font-size: 10pt;
            color: #111827;
        }
        table { width: 100%; border-collapse: collapse; }
        .company-name { font-size: 16pt; font-weight: bold; text-align: center; }
        .company-sub { font-size: 9pt; color: #6B7280; text-align: center; margin-bottom: 15pt; }
        .badge { background-color: #ECFDF5; color: #059669; padding: 4pt 12pt; border: 1pt solid #059669; text-align: center; font-weight: bold; font-size: 8pt; letter-spacing: 1pt; }
        .box { border: 1pt solid #E5E7EB; padding: 10pt; margin-bottom: 10pt; background: #ffffff; }
        .box-title { font-size: 10pt; font-weight: bold; border-bottom: 1pt solid #E5E7EB; padding-bottom: 5pt; margin-bottom: 5pt; }
        .th { font-size: 8pt; color: #6B7280; font-weight: bold; text-transform: uppercase; border-bottom: 1pt solid #E5E7EB; padding: 4pt; }
        .td { font-size: 9pt; padding: 4pt; border-bottom: 1pt solid #F3F4F6; }
        .muted { color: #6B7280; font-size: 8pt; margin-bottom: 2pt; }
        .val { font-size: 10pt; font-weight: bold; }
    </style>
</head>
<body>
    <div style="text-align: center; margin-bottom: 10pt;">
        <img src="https://img.icons8.com/ios-filled/96/3D9D9B/company.png" width="40" height="40" />
    </div>
    <div class="company-name">Estate Link</div>
    <div class="company-sub">Property Management Services</div>
    
    <table align="center" style="margin-bottom: 15pt; width: 30%;">
        <tr>
            <td class="badge">✓ PAYMENT RECEIVED</td>
        </tr>
    </table>

    <div class="box" style="background-color: #F9FAFB;">
        <table>
            <tr>
                <td width="33%">
                    <div class="muted">RECEIPT NUMBER</div>
                    <div class="val">RCP-2026-02-00016</div>
                </td>
                <td width="33%">
                    <div class="muted">TRANSACTION ID</div>
                    <div class="val">TXN-2026-02-00000016</div>
                </td>
                <td width="33%" align="right">
                    <div class="muted">PAYMENT DATE</div>
                    <div class="val">25-Feb-2026</div>
                </td>
            </tr>
            <tr><td colspan="3"><hr style="color: #E5E7EB; margin: 10pt 0;" /></td></tr>
            <tr>
                <td>
                    <div class="muted">METHOD</div>
                    <div class="val">Cash</div>
                </td>
                <td>
                    <div class="muted">FROM ACCOUNT</div>
                    <div class="val">N/A</div>
                </td>
                <td align="right">
                    <div class="muted">TO ACCOUNT</div>
                    <div class="val">N/A</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="box">
        <div class="box-title">Resident Information</div>
        <table>
            <tr>
                <td width="50%">
                    <div class="muted">Tower</div>
                    <div class="val" style="margin-bottom: 5pt;">email_test</div>
                    <div class="muted">Resident Name</div>
                    <div class="val" style="margin-bottom: 5pt;">mirza hasan</div>
                    <div class="muted">Phone</div>
                    <div class="val">01623398837</div>
                </td>
                <td width="50%">
                    <div class="muted">Unit Number</div>
                    <div class="val" style="margin-bottom: 5pt;">101</div>
                    <div class="muted">Email</div>
                    <div class="val" style="margin-bottom: 5pt;">tarekmahmud@gmail.com</div>
                </td>
            </tr>
        </table>
    </div>

    <div class="box">
        <div class="box-title">Payment Allocation</div>
        <table>
            <tr>
                <td class="th" width="25%">Bill Month</td>
                <td class="th" width="15%" align="right">Amount</td>
                <td class="th" width="15%" align="right">Penalty</td>
                <td class="th" width="15%" align="right">Waived</td>
                <td class="th" width="15%" align="right">Paid</td>
                <td class="th" width="15%" align="center">Status</td>
            </tr>
            <tr>
                <td class="td"><strong>December 2025</strong></td>
                <td class="td" align="right">Tk11000</td>
                <td class="td" align="right" style="color: red;">Tk100</td>
                <td class="td" align="right" style="color: green;">-</td>
                <td class="td" align="right"><strong>Tk11100</strong></td>
                <td class="td" align="center">
                    <table width="60%" align="center"><tr>
                        <td style="background-color: #FEF3C7; color: #B45309; text-align: center; font-size: 7pt; font-weight: bold; border: 1pt solid #D97706;">PARTIAL</td>
                    </tr></table>
                </td>
            </tr>
        </table>
        
        <table style="margin-top: 10pt;">
            <tr>
                <td width="70%" style="font-weight: bold;">Subtotal (Bills Payment)</td>
                <td width="30%" align="right" style="font-weight: bold;">Tk11100</td>
            </tr>
            <tr><td colspan="2"><hr style="border: 1pt dashed #E5E7EB; margin: 10pt 0;" /></td></tr>
            <tr>
                <td width="70%" style="font-size: 14pt; font-weight: bold;">Total Amount Paid</td>
                <td width="30%" align="right" style="font-size: 16pt; font-weight: bold; color: #3D9D9B;">Tk11100</td>
            </tr>
        </table>
    </div>

    <div class="box" style="background-color: #EFF6FF; color: #1E40AF; border: none;">
        <div style="font-size: 8pt; font-weight: bold;">NOTES</div>
        <div style="font-size: 9pt;">Service fee payment for email_test - 101.</div>
    </div>
</body>
</html>
"""

result = BytesIO()
pdf = pisa.pisaDocument(BytesIO(html.encode("UTF-8")), result)

if pdf.err:
    print("Failed")
else:
    pdf_bytes = result.getvalue()
    with open("test.pdf", 'wb') as f:
        f.write(pdf_bytes)
    print("Success")

# Convert to image
doc = fitz.open(stream=pdf_bytes, filetype="pdf")
page = doc.load_page(0)
pix = page.get_pixmap(dpi=150)
img_bytes = pix.tobytes("png")

b64 = base64.b64encode(img_bytes).decode('utf-8')

html_out = f"""
<!DOCTYPE html>
<html>
<head><title>PDF Preview</title></head>
<body style="margin: 0; padding: 20px; background: #ddd; text-align: center;">
    <img src="data:image/png;base64,{b64}" style="box-shadow: 0 0 10px rgba(0,0,0,0.5); border: 1px solid #ccc;" />
</body>
</html>
"""

with open('preview.html', 'w', encoding='utf-8') as f:
    f.write(html_out)
print("Preview written")
