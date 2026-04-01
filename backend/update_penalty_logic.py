
import os

file_path = r'h:\wamp64\www\estate-link\backend\service_fee_management\views.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the old condition
old_condition = "WHEN sf.late_payment_enabled = 1 THEN"
# Define the new condition
new_condition = "WHEN sf.late_payment_enabled = 1 AND CURRENT_DATE() > DATE(CONCAT(sfp.service_period_year, '-', LPAD(sfp.service_period_month, 2, '0'), '-', LPAD(COALESCE(sf.due_day, 5), 2, '0'))) THEN"

# Define the old result column (to insert sf.due_day)
old_col = "AS gross_penalty_amount,"
new_col = "AS gross_penalty_amount,\n                    \n                    sf.due_day,"

# Apply replacements
if old_condition in content:
    new_content = content.replace(old_condition, new_condition)
    print("Replaced conditions.")
else:
    print("Could not find old condition logic.")
    new_content = content

if old_col in new_content:
    if "sf.due_day," not in new_content: # Avoid double insertion
        new_content = new_content.replace(old_col, new_col)
        print("Added sf.due_day column.")
    else:
        print("sf.due_day already exists.")
else:
    print("Could not find gross_penalty_amount column.")

if new_content != content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully updated views.py")
else:
    print("No changes made.")
