'use client'

export default function PixelOfficePage() {
  return (
    <div className="w-full h-screen overflow-hidden">
      <iframe 
        src="http://localhost:18791" 
        className="w-full h-full border-0"
        title="Star Office UI"
      />
    </div>
  )
}
