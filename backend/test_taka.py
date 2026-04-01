import py_compile
py_compile.compile('service_fee_management/utils/email_utils.py', doraise=True)
print('Syntax OK')

from io import BytesIO
from xhtml2pdf import pisa
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont('NirmalaUI', r'C:\Windows\Fonts\Nirmala.ttc', subfontIndex=0))

html = """<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
@page { size: a4 portrait; margin: 20mm; }
body { font-family: NirmalaUI, Helvetica; font-size: 12pt; }
.green { color: #059669; font-weight: bold; }
</style>
</head>
<body>
<h2>Estate Link - Bengali Currency Test</h2>
<p>Bill Amount: <span class="green">\u09f31,254</span></p>
<p>Penalty: <span style="color:red">\u09f3100</span></p>
<p>Total Paid: <span class="green" style="font-size:16pt">\u09f31,254</span></p>
<p>Badge: <span style="background:#ECFDF5;color:#059669;padding:3px 10px;">\u2713 PAYMENT RECEIVED</span></p>
</body>
</html>"""

result = BytesIO()
pdf = pisa.pisaDocument(BytesIO(html.encode('UTF-8')), result)
if pdf.err:
    print('ERROR:', pdf.err)
else:
    with open('taka_test.pdf', 'wb') as f:
        f.write(result.getvalue())
    print('SUCCESS - taka_test.pdf generated, size:', len(result.getvalue()))
    print('Open taka_test.pdf to check if taka sign \u09f3 renders correctly')
