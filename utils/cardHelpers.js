// Extract helper functions to a separate file
export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

export const formatAssetId = (id) => {
  if (!id) return '';
  return id.startsWith('asst_') ? id.substring(5, 13) + '...' : id;
};

// Standardize parameter order: threadId first, then assistantId
export const getThreadUrl = (threadId, assistantId) => {
  if (!threadId || !assistantId) return null;
  return `https://platform.openai.com/playground/assistants?assistant=${assistantId}&thread=${threadId}`;
};

export const handleDownloadSvg = (svgContent, fileName = 'svg') => {
  if (!svgContent) return;
  
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.svg`;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}; 