# GeoAI MVP

A Next.js application that combines interactive mapping with AI-powered spatial analysis using DuckDB and spatial extensions.

## Features

- **Interactive Map**: Drop pins on the map to mark locations
- **AI Chat Interface**: Ask natural language questions about spatial operations
- **Spatial Operations**: Perform operations like buffering, nearest neighbors, and spatial queries
- **Pin-based Analysis**: Use dropped pins as data points for spatial operations

## How to Use

### Basic Usage

1. Drop pins on the map by clicking anywhere
2. Use the "Undo" button to remove the latest pin
3. Use the "Clear All" button to remove all pins
4. Ask the AI assistant questions about spatial operations

### Pin-based Spatial Operations

When you have pins on the map, you can ask the AI to perform operations using those pins as data points:

- **"Add a buffer of 10km around these features"** - Creates a buffer around all dropped pins
- **"Create a 5km buffer around the pins"** - Buffers around pin locations
- **"Buffer these points by 15 kilometers"** - Another way to request buffering

The system will:

1. Use your dropped pins as the input geometry
2. Create buffers around each pin
3. Union all buffers into a single polygon
4. Display the result on the map in blue

### Other Spatial Operations

- **Within queries**: Find points within a certain distance of a location
- **Nearest neighbors**: Find the k closest points to a location
- **General buffering**: Create buffers around any geometry

## Technical Details

- **Frontend**: Next.js with TypeScript, Tailwind CSS, and DeckGL for mapping
- **Backend**: Next.js API routes with DuckDB and spatial extensions
- **AI**: OpenAI GPT-4.1-mini for natural language processing
- **Spatial Engine**: DuckDB with spatial extensions for efficient spatial operations

## Development

```bash
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
