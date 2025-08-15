# Storyboard - AI Cinematic Storyboard Generator

## Project Overview

Storyboard is a Next.js application that transforms simple text prompts into complete, multi-scene cinematic storyboards with professional black and white sketches. The app uses advanced AI models to generate both scene descriptions and corresponding images.

## Architecture

### Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui components
- **Authentication**: Clerk (App Router approach)
- **Backend**: Convex (reactive database)
- **AI Services**: 
  - Gemini 2.0 Flash Lite (text generation)
  - Gemini 2.0 Flash Preview Image Generation (image generation)
- **Package Manager**: Bun
- **Deployment**: Vercel

### Core Workflow
1. User enters a text prompt describing their story idea
2. Text generation API creates 3-5 scenes with detailed descriptions
3. Each scene gets a specialized "mega text prompt" for image generation
4. Image generation API creates black & white charcoal sketches
5. Complete storyboard is displayed with scenes and images

## API Implementation

### Text Generation Service
**File**: `src/lib/gemini-text-service.ts`
- Uses Gemini 2.0 Flash Lite model
- Implements exact system prompt for cinematic storyboard generation
- Returns structured JSON with title and scenes
- Cost estimation: ~$0.075-0.30 per 1M tokens

### Image Generation Service
**File**: `src/lib/gemini-image-service.ts`
- Uses Gemini 2.0 Flash Preview Image Generation model
- Processes mega text prompts into 16:9 black & white sketches
- Returns base64 encoded images
- Cost: 3.9 cents per image

### API Routes
1. `/api/generate-story` - Text generation only
2. `/api/generate-image` - Image generation only  
3. `/api/generate-storyboard` - Complete workflow (text → images)

## Environment Variables

```bash
# Gemini API Key (for both text and image generation)
GEMINI_API_KEY=AIzaSyCC9LaW7WctJ1IVvksxOIcw33r-PsEcSrc

# Clerk Authentication Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Ym9sZC1nbGlkZXItNjAuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_3K5sMQ1UDLxYgXo5EfETEZba7DMs1LFWrZfHM4ghAF

# Convex (auto-generated in agent mode)
CONVEX_AGENT_MODE=anonymous
CONVEX_DEPLOYMENT=anonymous:anonymous-agent
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
```

## Database Schema (Convex)

### Tables
- **users**: User profiles linked to Clerk IDs
- **storyboards**: Storyboard metadata and status tracking
- **scenes**: Individual scenes with images and prompts
- **generations**: Generation tracking for retries and cost monitoring

### Key Functions
- `convex/users.ts`: User management (create, get, update)
- `convex/storyboards.ts`: Storyboard CRUD operations
- `convex/scenes.ts`: Scene management and image handling

## Cost Structure

### Pricing Breakdown
- **Text Generation**: $0.075-0.30 per 1M tokens (variable based on input/output)
- **Image Generation**: $0.039 per image
- **Total per Storyboard**: ~$0.12-0.20 (3-5 scenes)

### Cost Tracking
The app tracks both estimated and actual costs:
- Text generation costs calculated based on token usage
- Image generation costs fixed at 3.9¢ per image
- Real-time cost display in the UI

## Authentication Setup

### Clerk Configuration
Uses latest App Router approach with:
- `middleware.ts` with `clerkMiddleware()`
- `ClerkProvider` wrapper in layout
- Authentication components: `SignInButton`, `SignUpButton`, `UserButton`
- Protected API routes with auth checks

## Development Commands

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Lint code
bun run lint

# Initialize Convex (if needed)
bunx convex dev
```

## API Usage Examples

### Generate Complete Storyboard
```javascript
const response = await fetch('/api/generate-storyboard', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: "A detective investigates mysterious disappearances in a cyberpunk city",
    generateImages: true
  })
});
```

### Response Format
```json
{
  "success": true,
  "data": {
    "title": "Neon Shadows",
    "scenes": [
      {
        "scene_number": 1,
        "scene_description": "Detective examines evidence in rain-soaked alley",
        "image_prompt": "...",
        "imageData": "base64_encoded_image",
        "contentType": "image/png",
        "status": "completed"
      }
    ],
    "status": "completed",
    "costs": {
      "estimated": 0.156,
      "actual": 0.142,
      "text": 0.025,
      "images": 0.117
    }
  }
}
```

## System Prompt Details

The text generation uses a carefully crafted system prompt that:
- Defines the AI as an expert Director and Cinematographer
- Creates 3-5 scene structured narratives
- Generates "mega text prompts" for image generation
- Includes specific technical requirements for black & white sketches
- Enforces strict JSON output format

## Error Handling

### Common Error Scenarios
1. **Authentication failures**: 401 responses for unauthenticated requests
2. **API rate limits**: 429 responses with retry suggestions
3. **Invalid prompts**: Input validation with helpful error messages
4. **Partial failures**: Graceful handling when some images fail to generate
5. **JSON parsing errors**: Robust parsing with fallback error messages

## Security Features

- API key protection through environment variables
- Clerk authentication for all generation endpoints
- Input validation and sanitization
- Rate limiting awareness
- No sensitive data logging

## File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── generate-story/route.ts
│   │   ├── generate-image/route.ts
│   │   └── generate-storyboard/route.ts
│   ├── ConvexClientProvider.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/ui/
│   └── [shadcn components]
├── lib/
│   ├── gemini-text-service.ts
│   └── gemini-image-service.ts
└── middleware.ts

convex/
├── schema.ts
├── users.ts
├── storyboards.ts
└── scenes.ts
```

## Deployment Notes

### Vercel Configuration
- Environment variables must be set in Vercel dashboard
- Build command: `bun run build`
- Output directory: `.next`
- Node.js version: 18+

### Performance Considerations
- Images are returned as base64 (consider storage optimization)
- API routes have 30-second timeout limits
- Convex provides real-time updates for collaborative features

## GitHub Rules Followed

1. ✅ Push when functionality is working
2. ✅ Never commit node_modules or claude.md
3. ✅ No Claude co-author in commits
4. ✅ Always commit bun.lockb file

## Future Enhancements

1. **Data Persistence**: Save storyboards to Convex database
2. **File Storage**: Use Convex storage for generated images
3. **User Dashboard**: History and management interface
4. **Retry Logic**: Automatic retry for failed generations
5. **Export Features**: PDF/image export functionality
6. **Collaboration**: Share and collaborate on storyboards