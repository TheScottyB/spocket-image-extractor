// Vision API utility for OpenAI Vision analysis
class VisionAPI {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseURL = options.baseURL || 'https://api.openai.com/v1';
    this.model = options.model || 'gpt-4-vision-preview';
    this.maxTokens = options.maxTokens || 500;
    this.temperature = options.temperature || 0.7;
    this.debug = options.debug || false;
  }

  async analyzeImage(imageUrl, prompt = "Describe this product image in detail") {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    const payload = {
      model: this.model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: this.maxTokens,
      temperature: this.temperature
    };

    if (this.debug) {
      console.log('Vision API request:', payload);
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (this.debug) {
        console.log('Vision API response:', data);
      }

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenAI Vision API');
      }

      return {
        success: true,
        content: data.choices[0].message.content,
        usage: data.usage,
        model: data.model
      };

    } catch (error) {
      if (this.debug) {
        console.error('Vision API error:', error);
      }
      return {
        success: false,
        error: error.message
      };
    }
  }

  async extractProductMetadata(imageUrl) {
    const prompt = `Analyze this product image and extract the following information in JSON format:
    {
      "productName": "product name",
      "description": "detailed description",
      "price": "price if visible",
      "brand": "brand name if visible", 
      "category": "product category",
      "keyFeatures": ["feature1", "feature2"],
      "colors": ["color1", "color2"],
      "confidence": 0.8
    }
    
    Only include fields where you have high confidence. Set confidence between 0-1.`;

    const result = await this.analyzeImage(imageUrl, prompt);
    
    if (!result.success) {
      return result;
    }

    try {
      // Try to parse JSON from the response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const metadata = JSON.parse(jsonMatch[0]);
        return {
          success: true,
          metadata: metadata,
          rawContent: result.content
        };
      } else {
        // Fallback: return structured data from text
        return {
          success: true,
          metadata: {
            description: result.content,
            confidence: 0.5
          },
          rawContent: result.content
        };
      }
    } catch (parseError) {
      return {
        success: true,
        metadata: {
          description: result.content,
          confidence: 0.3
        },
        rawContent: result.content,
        parseError: parseError.message
      };
    }
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.VisionAPI = VisionAPI;
}
