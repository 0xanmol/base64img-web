import { useState, useRef, useCallback, useEffect } from 'react'

interface ImageMetadata {
  filename: string
  type: string
  size: number
  width: number
  height: number
}

interface OutputData {
  dataUri: string
  outputSizeKB: number
  outputWidth: number
  outputHeight: number
}

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null)
  const [outputData, setOutputData] = useState<OutputData | null>(null)
  const [canvasSize, setCanvasSize] = useState(256)
  const [fitToSquare, setFitToSquare] = useState(true)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const clearMessages = () => {
    setError(null)
    setSuccess(null)
  }

  const showError = (message: string) => {
    setError(message)
    setSuccess(null)
  }

  const showSuccess = (message: string) => {
    setSuccess(message)
    setError(null)
  }

  const isValidImageType = (type: string): boolean => {
    return ALLOWED_TYPES.includes(type)
  }

  const processImage = useCallback(async (file: File) => {
    clearMessages()
    setIsProcessing(true)

    try {
      if (!isValidImageType(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}. Please use PNG, JPEG, WEBP, or SVG.`)
      }

      // Read file as data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })

      // Load image
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = dataUrl
      })

      // Wait for image to fully decode
      await img.decode()

      // Set metadata
      setImageMetadata({
        filename: file.name,
        type: file.type,
        size: file.size,
        width: img.naturalWidth,
        height: img.naturalHeight
      })

      // Create canvas and convert to PNG data URI
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        throw new Error('Canvas context not available')
      }

      // Get current values at processing time
      const currentFitToSquare = fitToSquare
      const currentCanvasSize = canvasSize

      if (currentFitToSquare) {
        // Set canvas to square dimensions
        canvas.width = currentCanvasSize
        canvas.height = currentCanvasSize

        // Calculate scale to fit image within square while maintaining aspect ratio
        const scale = Math.min(currentCanvasSize / img.naturalWidth, currentCanvasSize / img.naturalHeight)
        const scaledWidth = img.naturalWidth * scale
        const scaledHeight = img.naturalHeight * scale

        // Center the image
        const x = (currentCanvasSize - scaledWidth) / 2
        const y = (currentCanvasSize - scaledHeight) / 2

        // Clear canvas with transparent background
        ctx.clearRect(0, 0, currentCanvasSize, currentCanvasSize)
        
        // Draw image centered
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight)
      } else {
        // Use image's native dimensions
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        ctx.drawImage(img, 0, 0)
      }

      // Convert to PNG data URI
      const pngDataUri = canvas.toDataURL('image/png')
      
      // Calculate output size in KB
      const base64Data = pngDataUri.split(',')[1]
      const outputSizeBytes = Math.round((base64Data.length * 3) / 4)
      const outputSizeKB = Math.round(outputSizeBytes / 1024 * 10) / 10

      setOutputData({
        dataUri: pngDataUri,
        outputSizeKB,
        outputWidth: canvas.width,
        outputHeight: canvas.height
      })

    } catch (err) {
      showError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    processImage(file)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleCopyDataUri = async () => {
    if (!outputData?.dataUri) return

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(outputData.dataUri)
        showSuccess('Data URI copied to clipboard!')
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea')
        textarea.value = outputData.dataUri
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        showSuccess('Data URI copied to clipboard!')
      }
    } catch {
      showError('Failed to copy to clipboard')
    }
  }

  const handleDownloadTxt = () => {
    if (!outputData?.dataUri) return

    try {
      const blob = new Blob([outputData.dataUri], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'walletIcon.datauri.txt'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showSuccess('File downloaded successfully!')
    } catch {
      showError('Failed to download file')
    }
  }

  const handleCanvasSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value)
    if (value >= 8 && value <= 2048) {
      setCanvasSize(value)
    }
  }

  const handleFitToSquareChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFitToSquare(e.target.checked)
  }

  // Re-process when controls change
  useEffect(() => {
    if (selectedFile && !isProcessing) {
      const timeoutId = setTimeout(() => {
        processImage(selectedFile)
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [canvasSize, fitToSquare, selectedFile])

  return (
    <div className="app">
      <header className="header">
        <h1>Base64 Image Converter</h1>
        <p>Convert images to PNG data URIs with optional square canvas fitting</p>
      </header>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <section className="upload-section">
        <div
          className={`drop-zone ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-zone-content">
            <div className="drop-zone-icon">📷</div>
            <div className="drop-zone-text">
              {selectedFile ? `Selected: ${selectedFile.name}` : 'Click or drag and drop an image here'}
            </div>
            <button className="btn" type="button">
              Choose File
            </button>
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="file-input"
          onChange={handleFileInputChange}
        />
      </section>

      {selectedFile && (
        <section className="controls">
          <h3>Conversion Settings</h3>
          <div className="control-group">
            <div className="control-item">
              <label htmlFor="canvas-size">Canvas Size:</label>
              <input
                id="canvas-size"
                type="number"
                min="8"
                max="2048"
                step="8"
                value={canvasSize}
                onChange={handleCanvasSizeChange}
              />
              <span>px</span>
            </div>
            <div className="control-item">
              <input
                id="fit-to-square"
                type="checkbox"
                checked={fitToSquare}
                onChange={handleFitToSquareChange}
              />
              <label htmlFor="fit-to-square">Fit to square canvas</label>
            </div>
          </div>
        </section>
      )}

      {imageMetadata && outputData && (
        <section className="preview-section">
          <div className="preview-grid">
            <div className="preview-item">
              <h4>Preview</h4>
              <img
                src={outputData.dataUri}
                alt="Converted"
                className="image-preview"
              />
            </div>
            <div className="preview-item">
              <h4>Metadata</h4>
              <div className="metadata">
                <div><strong>Original:</strong></div>
                <div>• Filename: {imageMetadata.filename}</div>
                <div>• Type: {imageMetadata.type}</div>
                <div>• Size: {Math.round(imageMetadata.size / 1024 * 10) / 10} KB</div>
                <div>• Dimensions: {imageMetadata.width}×{imageMetadata.height}</div>
                <br />
                <div><strong>Output:</strong></div>
                <div>• Format: image/png (Data URI)</div>
                <div>• Size: {outputData.outputSizeKB} KB</div>
                <div>• Dimensions: {outputData.outputWidth}×{outputData.outputHeight}</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {outputData && (
        <section className="output-section">
          <h3>Data URI Output</h3>
          <textarea
            className="output-textarea"
            value={outputData.dataUri}
            readOnly
            placeholder="Generated data URI will appear here..."
          />
          <div className="button-group">
            <button
              className="btn"
              onClick={handleCopyDataUri}
              disabled={isProcessing}
            >
              📋 Copy Data URI
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleDownloadTxt}
              disabled={isProcessing}
            >
              💾 Download .txt
            </button>
          </div>
        </section>
      )}

      {isProcessing && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div>Processing image...</div>
        </div>
      )}
    </div>
  )
}

export default App
