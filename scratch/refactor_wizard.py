import re

with open('apps/web/src/pages/OrderWizardPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove step state
content = re.sub(r'const \[step, setStep\] = useState\(1\);\n\s*', '', content)
content = re.sub(r'const handleNext = \(\) => setStep\(\(s\) => Math\.min\(s \+ 1, 3\)\);\n\s*', '', content)
content = re.sub(r'const handlePrev = \(\) => setStep\(\(s\) => Math\.max\(s - 1, 1\)\);\n\s*', '', content)

# Replace the progress bar and header
header_start = content.find('<div className="flex items-center justify-between shrink-0 mb-6">')
header_end = content.find('<Card className="flex-1 flex flex-col min-h-0 overflow-hidden" padding="none">')
new_header = """<div className="flex items-center justify-between shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
        {customer && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-md text-sm">
            <span className="font-semibold text-green-900">{customer.name}</span>
            <span className="text-green-700">({customer.phone})</span>
          </div>
        )}
      </div>

      """
content = content[:header_start] + new_header + content[header_end:]

# The Card content starts with <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50">
step1_start = content.find('{step === 1 && (')
step2_start = content.find('{step === 2 && (')

# Remove step 1
content = content[:step1_start] + content[step2_start:]

# Remove the {step === 2 && ( wrapper
content = content.replace('{step === 2 && (', '')

# Find where step 3 starts and replace everything until the end of the Card with the new footer
step3_start = content.find('{step === 3 &&')
card_end = content.find('</Card>')

# Find the stray `)}` that used to close step 2 before step 3 started.
# It should be the last thing before `step === 3 &&`
content = content[:step3_start]
last_brace = content.rfind(')}')
content = content[:last_brace]

new_footer = """
        <div className="flex justify-between p-4 border-t bg-white shrink-0">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateOrder}
            disabled={isSubmitting || items.length === 0 || !selectedCustomerId}
          >
            {isSubmitting ? 'Creating...' : 'Create Order & View Bill'}
          </Button>
        </div>
      </Card>
"""

with open('apps/web/src/pages/OrderWizardPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content + new_footer + """    </div>
  );
}
""")
