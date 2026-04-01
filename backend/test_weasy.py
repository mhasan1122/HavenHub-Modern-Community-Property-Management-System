
import sys
try:
    from weasyprint import HTML
    print("WeasyPrint imported successfully.")
    html_content = "<h1>Test</h1>"
    # Try a simple PDF generation to check dependencies
    from io import BytesIO
    out = BytesIO()
    HTML(string=html_content).write_pdf(out)
    print("PDF generation successful!")
except Exception as e:
    print(f"Error: {e}")
