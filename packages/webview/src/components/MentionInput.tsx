import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MentionParser, MentionToken, MentionSuggestion, MentionContext, AutocompleteEngine, FileAutocompleteProvider } from '@codeweaver/core';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onTokensChange?: (tokens: MentionToken[]) => void;
  placeholder?: string;
  context?: MentionContext;
  className?: string;
  disabled?: boolean;
}

interface AutocompleteState {
  isOpen: boolean;
  suggestions: MentionSuggestion[];
  selectedIndex: number;
  triggerPosition: number;
  partialMention: string;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onTokensChange,
  placeholder = "Type @ to mention files, functions, errors...",
  context,
  className = '',
  disabled = false
}) => {
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>({
    isOpen: false,
    suggestions: [],
    selectedIndex: 0,
    triggerPosition: 0,
    partialMention: ''
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const parser = useRef(new MentionParser());
  const autocompleteEngine = useRef(new AutocompleteEngine());

  // Initialize autocomplete providers
  useEffect(() => {
    // Register file provider (in real app, this would get files from the client)
    const fileProvider = new FileAutocompleteProvider(async () => {
      // Mock file list - in real implementation, this would come from WebSocket client
      return [
        { path: 'src/components/App.tsx', lastModified: new Date(), gitStatus: 'M' },
        { path: 'src/types/index.ts', lastModified: new Date() },
        { path: 'package.json', lastModified: new Date() }
      ];
    });
    
    autocompleteEngine.current.registerProvider(fileProvider);
  }, []);

  // Parse tokens when value changes
  useEffect(() => {
    const tokens = parser.current.parse(value);
    onTokensChange?.(tokens);
  }, [value, onTokensChange]);

  // Handle input changes
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart;
    
    onChange(newValue);
    
    // Check for @mention trigger
    const partialMention = parser.current.getPartialMentionAtPosition(newValue, cursorPosition);
    
    if (partialMention) {
      handleAutocomplete(partialMention.partial.substring(1), partialMention.start); // Remove @ from partial
    } else {
      setAutocomplete(prev => ({ ...prev, isOpen: false }));
    }
  }, [onChange]);

  // Handle autocomplete
  const handleAutocomplete = useCallback(async (query: string, position: number) => {
    try {
      // Get suggestions from parser first (for basic types)
      const basicSuggestions = parser.current.autocomplete(
        value,
        position + query.length + 1, // +1 for @
        context
      );

      // Get advanced suggestions from autocomplete engine
      let advancedSuggestions: MentionSuggestion[] = [];
      if (query.length > 0) {
        // Determine mention type from query
        const mentionTypes = ['file', 'function', 'class', 'error', 'diff'];
        const matchingTypes = mentionTypes.filter(type => type.startsWith(query));
        
        if (matchingTypes.length > 0) {
          advancedSuggestions = await autocompleteEngine.current.getMultiTypeSuggestions(
            matchingTypes,
            query,
            context
          );
        }
      }

      // Merge and deduplicate suggestions
      const allSuggestions = [...basicSuggestions, ...advancedSuggestions];
      const uniqueSuggestions = Array.from(
        new Map(allSuggestions.map(s => [s.label, s])).values()
      );

      setAutocomplete({
        isOpen: uniqueSuggestions.length > 0,
        suggestions: uniqueSuggestions.slice(0, 10), // Limit to 10 suggestions
        selectedIndex: 0,
        triggerPosition: position,
        partialMention: '@' + query
      });
    } catch (error) {
      console.error('Error getting autocomplete suggestions:', error);
      setAutocomplete(prev => ({ ...prev, isOpen: false }));
    }
  }, [value, context]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!autocomplete.isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setAutocomplete(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, prev.suggestions.length - 1)
        }));
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setAutocomplete(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0)
        }));
        break;
        
      case 'Tab':
      case 'Enter':
        e.preventDefault();
        if (autocomplete.suggestions[autocomplete.selectedIndex]) {
          selectSuggestion(autocomplete.suggestions[autocomplete.selectedIndex]);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        setAutocomplete(prev => ({ ...prev, isOpen: false }));
        break;
    }
  }, [autocomplete]);

  // Select a suggestion
  const selectSuggestion = useCallback((suggestion: MentionSuggestion) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const beforeMention = value.substring(0, autocomplete.triggerPosition);
    const afterMention = value.substring(autocomplete.triggerPosition + autocomplete.partialMention.length);
    
    let newValue: string;
    if (suggestion.value) {
      newValue = `${beforeMention}@${suggestion.type}:${suggestion.value}${afterMention}`;
    } else {
      newValue = `${beforeMention}@${suggestion.type}:${afterMention}`;
    }
    
    onChange(newValue);
    
    // Position cursor after the mention
    const newCursorPosition = beforeMention.length + `@${suggestion.type}:${suggestion.value || ''}`.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    }, 0);
    
    setAutocomplete(prev => ({ ...prev, isOpen: false }));
  }, [value, autocomplete.triggerPosition, autocomplete.partialMention.length, onChange]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAutocomplete(prev => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, [value]);

  const renderSuggestion = (suggestion: MentionSuggestion, index: number) => (
    <div
      key={`${suggestion.type}-${suggestion.value}-${index}`}
      className={`mention-suggestion ${index === autocomplete.selectedIndex ? 'selected' : ''}`}
      onClick={() => selectSuggestion(suggestion)}
      onMouseEnter={() => setAutocomplete(prev => ({ ...prev, selectedIndex: index }))}
    >
      <div className="suggestion-header">
        <span className="suggestion-icon">{suggestion.icon}</span>
        <span className="suggestion-label">{suggestion.label}</span>
        {suggestion.metadata?.errorCount && (
          <span className="error-count">{suggestion.metadata.errorCount} errors</span>
        )}
        {suggestion.metadata?.fileCount && (
          <span className="file-count">{suggestion.metadata.fileCount} files</span>
        )}
      </div>
      {suggestion.description && (
        <div className="suggestion-description">{suggestion.description}</div>
      )}
    </div>
  );

  return (
    <div className={`mention-input-container ${className}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="mention-textarea"
        rows={3}
      />
      
      {autocomplete.isOpen && (
        <div ref={dropdownRef} className="mention-dropdown">
          <div className="dropdown-header">
            <span className="dropdown-title">@Mentions</span>
            <span className="dropdown-hint">↑↓ to navigate, ↵ to select, Esc to close</span>
          </div>
          <div className="suggestions-list">
            {autocomplete.suggestions.map(renderSuggestion)}
          </div>
        </div>
      )}
    </div>
  );
};

export default MentionInput;