// Determine API base automatically: use same origin in production, localhost in dev
const API_URL = (typeof window !== 'undefined' && window.location && window.location.origin)
  ? (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
      ? 'http://localhost:3001'
      : window.location.origin)
  : 'http://localhost:3001';

export interface FileUpdateRequest {
  oldText: string;
  newText: string;
}

/** Client for server-side file update endpoint. */
export class FileUpdateService {
  async updateManual(oldText: string, newText: string): Promise<boolean> {
    try {
      
      console.log('Update request:', { oldLen: oldText.length, newLen: newText.length });
      
      const response = await fetch(`${API_URL}/api/update-manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oldText, newText }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Error updating file:', error);
        return false;
      }

      const result = await response.json();
      console.log('File updated successfully:', result);
      return true;
    } catch (error) {
      console.error('Error updating file:', error);
      return false;
    }
  }
}

