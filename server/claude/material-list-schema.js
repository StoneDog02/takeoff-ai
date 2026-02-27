/**
 * JSON schema for structured material list output.
 * Used in the takeoff prompt so Claude returns parseable JSON.
 */
module.exports = {
  type: 'object',
  required: ['categories'],
  properties: {
    categories: {
      type: 'array',
      description: 'Material categories (e.g. Lumber, Concrete, Roofing)',
      items: {
        type: 'object',
        required: ['name', 'items'],
        properties: {
          name: { type: 'string', description: 'Category name' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['description', 'quantity', 'unit'],
              properties: {
                description: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string', description: 'e.g. LF, SF, CY, EA' },
                notes: { type: 'string' },
              },
            },
          },
        },
      },
    },
    summary: {
      type: 'string',
      description: 'Optional brief summary of the takeoff',
    },
  },
}
