import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface DynamicTemplateRendererProps {
  templateText: string;
  userFields: Record<string, string | number>;
  aiFields: Record<string, string>;
  onUserFieldChange?: (key: string, value: string | number) => void;
  editable?: boolean;
}

interface TemplatePart {
  type: 'text' | 'userField' | 'aiField';
  content: string;
  fieldKey?: string;
}

export function DynamicTemplateRenderer({
  templateText,
  userFields,
  aiFields,
  onUserFieldChange,
  editable = false
}: DynamicTemplateRendererProps) {
  
  const parseTemplate = (text: string): TemplatePart[] => {
    const parts: TemplatePart[] = [];
    let currentPos = 0;
    
    const userFieldRegex = /\[([^\]]+)\]/g;
    const aiFieldRegex = /\{([^}]+)\}/g;
    
    const allMatches: Array<{ type: 'userField' | 'aiField'; key: string; index: number; length: number }> = [];
    
    let match;
    while ((match = userFieldRegex.exec(text)) !== null) {
      allMatches.push({
        type: 'userField',
        key: match[1].trim(),
        index: match.index,
        length: match[0].length
      });
    }
    
    while ((match = aiFieldRegex.exec(text)) !== null) {
      allMatches.push({
        type: 'aiField',
        key: match[1].trim(),
        index: match.index,
        length: match[0].length
      });
    }
    
    allMatches.sort((a, b) => a.index - b.index);
    
    for (const fieldMatch of allMatches) {
      if (fieldMatch.index > currentPos) {
        parts.push({
          type: 'text',
          content: text.substring(currentPos, fieldMatch.index)
        });
      }
      
      parts.push({
        type: fieldMatch.type,
        content: '',
        fieldKey: fieldMatch.key
      });
      
      currentPos = fieldMatch.index + fieldMatch.length;
    }
    
    if (currentPos < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(currentPos)
      });
    }
    
    return parts;
  };
  
  const renderPart = (part: TemplatePart, index: number) => {
    if (part.type === 'text') {
      return <span key={index} dangerouslySetInnerHTML={{ __html: part.content.replace(/\n/g, '<br/>') }} />;
    }
    
    if (part.type === 'userField' && part.fieldKey) {
      const value = userFields[part.fieldKey];
      const isEmpty = value === undefined || value === '' || value === 0;
      
      if (!editable) {
        return (
          <span
            key={index}
            className={`user-field-display ${isEmpty ? 'bg-yellow-100 border border-yellow-400 px-1 rounded text-yellow-700 italic' : 'bg-blue-50 border-b border-blue-400 px-1'}`}
            data-field={part.fieldKey}
            data-testid={`field-${part.fieldKey}`}
          >
            {isEmpty ? `[${part.fieldKey}]` : value}
          </span>
        );
      }
      
      const isMultiline = part.fieldKey.includes('omschrijving') || part.fieldKey.includes('toelichting') || part.fieldKey.includes('motivering');
      
      if (isMultiline) {
        return (
          <Textarea
            key={index}
            value={value || ''}
            onChange={(e) => onUserFieldChange?.(part.fieldKey!, e.target.value)}
            placeholder={`[${part.fieldKey}]`}
            className={`inline-block min-w-[200px] min-h-[60px] align-middle ${
              isEmpty 
                ? 'border-yellow-400 bg-yellow-50 text-yellow-700 placeholder-yellow-500' 
                : 'border-blue-400 bg-blue-50'
            }`}
            data-field={part.fieldKey}
            data-testid={`input-${part.fieldKey}`}
          />
        );
      }
      
      return (
        <Input
          key={index}
          type="text"
          value={value || ''}
          onChange={(e) => onUserFieldChange?.(part.fieldKey!, e.target.value)}
          placeholder={`[${part.fieldKey}]`}
          className={`inline-block border-b px-1 min-w-[100px] ${
            isEmpty 
              ? 'border-yellow-400 bg-yellow-50 text-yellow-700 placeholder-yellow-500' 
              : 'border-blue-400 bg-blue-50'
          }`}
          data-field={part.fieldKey}
          data-testid={`input-${part.fieldKey}`}
        />
      );
    }
    
    if (part.type === 'aiField' && part.fieldKey) {
      const value = aiFields[part.fieldKey];
      const isEmpty = !value;
      
      const isMultiline = part.fieldKey.includes('motivering') || part.fieldKey.includes('gronden') || part.fieldKey.includes('analyse');
      
      if (isMultiline) {
        return (
          <div
            key={index}
            className="ai-field-display bg-amber-50 border border-amber-200 p-3 rounded text-amber-800 italic min-h-[80px] my-2"
            data-field={part.fieldKey}
            data-testid={`ai-${part.fieldKey}`}
          >
            {isEmpty ? `[Wordt gegenereerd: {${part.fieldKey}}]` : value}
          </div>
        );
      }
      
      return (
        <span
          key={index}
          className="ai-field-display bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-amber-800 italic inline-block min-w-[100px]"
          data-field={part.fieldKey}
          data-testid={`ai-${part.fieldKey}`}
        >
          {isEmpty ? `{${part.fieldKey}}` : value}
        </span>
      );
    }
    
    return null;
  };
  
  const parts = parseTemplate(templateText);
  
  return (
    <div className="dynamic-template bg-white p-6 rounded-lg shadow-sm" data-testid="dynamic-template">
      <div className="template-content text-base leading-relaxed">
        {parts.map((part, index) => renderPart(part, index))}
      </div>
    </div>
  );
}
