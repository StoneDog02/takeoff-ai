import { useState } from 'react'

interface FAQItem {
  question: string
  answer: string
}

interface FAQAccordionProps {
  items: FAQItem[]
}

export function FAQAccordion({ items }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      {items.map((item, i) => (
        <div
          key={item.question}
          className="border border-gray-200 rounded-lg overflow-hidden bg-white"
        >
          <button
            type="button"
            className="w-full px-4 py-4 flex items-center justify-between text-left font-medium text-gray-900 hover:bg-gray-50"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          >
            {item.question}
            <span
              className={`text-gray-500 transition-transform ${
                openIndex === i ? 'rotate-180' : ''
              }`}
            >
              ▼
            </span>
          </button>
          {openIndex === i && (
            <div className="px-4 pb-4 text-gray-600 text-sm border-t border-gray-100 pt-2">
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
