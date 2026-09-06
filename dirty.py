import wn
import tkinter as tk
from tkinter import ttk

class VocabBrowserApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Vocab Keep - OMW Browser (Full Lexicon)")
        self.geometry("1000x700")
        
        # Comprehensive list of standard OMW language codes
        self.languages = [
            'en', 'pt', 'es', 'fr', 'de', 'it', 'ja', 'cmn', 'nl', 'ar', 
            'ca', 'eu', 'fi', 'gl', 'hr', 'id', 'zsm', 'pl', 'ro', 'ru', 
            'sk', 'sl', 'sv', 'th', 'tr'
        ]
        
        self.current_words = []
        self.filtered_words = []
        
        self.create_widgets()
        # Pre-download English to start
        self.load_language('en')

    def create_widgets(self):
        control_frame = ttk.Frame(self, padding=10)
        control_frame.pack(fill=tk.X)
        
        ttk.Label(control_frame, text="Language:").pack(side=tk.LEFT, padx=5)
        self.lang_var = tk.StringVar(value='en')
        lang_combo = ttk.Combobox(control_frame, textvariable=self.lang_var, values=self.languages, state="readonly", width=10)
        lang_combo.pack(side=tk.LEFT, padx=5)
        lang_combo.bind("<<ComboboxSelected>>", lambda e: self.load_language(self.lang_var.get()))
        
        ttk.Label(control_frame, text="Search Term:").pack(side=tk.LEFT, padx=(20, 5))
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *args: self.filter_words())
        search_entry = ttk.Entry(control_frame, textvariable=self.search_var, width=25)
        search_entry.pack(side=tk.LEFT, padx=5)
        
        self.status_label = ttk.Label(control_frame, text="Ready.")
        self.status_label.pack(side=tk.RIGHT, padx=5)

        # Main Split Panes
        main_pane = ttk.PanedWindow(self, orient=tk.HORIZONTAL)
        main_pane.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Left: Word List
        left_frame = ttk.Frame(main_pane)
        main_pane.add(left_frame, weight=1)
        
        self.word_listbox = tk.Listbox(left_frame, exportselection=False)
        self.word_listbox.pack(fill=tk.BOTH, expand=True, side=tk.LEFT)
        self.word_listbox.bind("<<ListboxSelect>>", self.on_word_select)
        
        scrollbar = ttk.Scrollbar(left_frame, orient=tk.VERTICAL, command=self.word_listbox.yview)
        scrollbar.pack(fill=tk.Y, side=tk.RIGHT)
        self.word_listbox.configure(yscrollcommand=scrollbar.set)
        
        # Right: Data & Translations Detail View
        right_frame = ttk.Frame(main_pane, padding=10)
        main_pane.add(right_frame, weight=3)
        
        ttk.Label(right_frame, text="Lexeme Data & Cross-Language Translations", font=("Arial", 11, "bold")).pack(anchor=tk.W, pady=(0, 10))
        
        self.detail_text = tk.Text(right_frame, wrap=tk.WORD, font=("Consolas", 10))
        self.detail_text.pack(fill=tk.BOTH, expand=True)

    def load_language(self, lang):
        self.status_label.config(text=f"Ensuring omw-{lang} is downloaded (may take a moment)...")
        self.update_idletasks()
        
        try:
            wn.download(f'omw-{lang}')
        except Exception as e:
            print(f"Note: Could not download omw-{lang}: {e}")
            
        self.status_label.config(text=f"Loading {lang.upper()} words into memory...")
        self.update_idletasks()
        
        self.current_words = wn.words(lang=lang)
        self.filter_words()

    def filter_words(self):
        query = self.search_var.get().lower()
        self.word_listbox.delete(0, tk.END)
        
        self.filtered_words = []
        lemmas_to_insert = []
        
        # Filter words
        for word in self.current_words:
            lemma = word.lemma() if callable(getattr(word, 'lemma', None)) else getattr(word, 'lemma', '')
            if query in lemma.lower():
                self.filtered_words.append(word)
                lemmas_to_insert.append(lemma)
                
        # Bulk insert (Extremely fast, bypasses the 1000 limit safely)
        if lemmas_to_insert:
            self.word_listbox.insert(tk.END, *lemmas_to_insert)
            
        self.status_label.config(text=f"Showing all {len(lemmas_to_insert)} matches (Total: {len(self.current_words)})")

    def on_word_select(self, event):
        selection = self.word_listbox.curselection()
        if not selection:
            return
            
        index = selection[0]
        word = self.filtered_words[index]
        
        lemma = word.lemma() if callable(getattr(word, 'lemma', None)) else getattr(word, 'lemma', '')
        pos = getattr(word, 'pos', 'unknown')
        
        output = []
        output.append(f"Word Lemma: {lemma}")
        output.append(f"Part of Speech (POS): {pos}")
        output.append(f"Word ID: {word.id}\n")
        output.append("--- Senses & Cross-Language Translations (via CILI) ---")
        
        for sense in word.senses():
            synset = sense.synset()
            ili_val = getattr(synset, 'ili', None)
            cili_id = getattr(ili_val, 'id', ili_val) if ili_val else "None"
            
            defs = synset.definitions() if hasattr(synset, 'definitions') else []
            definition = defs[0] if defs else "No definition available"
            
            output.append(f"\n[Sense ID: {sense.id}]")
            output.append(f"CILI ID: {cili_id}")
            output.append(f"Definition: {definition}")
            
            output.append("Translations:")
            if ili_val:
                translations_dict = {}
                try:
                    target_synsets = wn.synsets(ili=cili_id)
                    for ts in target_synsets:
                        for w in ts.words():
                            # FIX: Call lexicon() since it is a function
                            lexicon = w.lexicon() if callable(getattr(w, 'lexicon', None)) else getattr(w, 'lexicon', None)
                            w_lang = getattr(lexicon, 'language', 'unknown') if lexicon else 'unknown'
                            
                            if w_lang == self.lang_var.get():
                                continue # Skip the language we are already looking at
                            
                            w_lemma = w.lemma() if callable(getattr(w, 'lemma', None)) else getattr(w, 'lemma', '')
                            if w_lang not in translations_dict:
                                translations_dict[w_lang] = set()
                            translations_dict[w_lang].add(w_lemma)
                            
                    if translations_dict:
                        for t_lang, t_lemmas in translations_dict.items():
                            output.append(f"  - {t_lang.upper()}: {', '.join(t_lemmas)}")
                    else:
                        output.append("  - (None found in downloaded lexicons)")
                except Exception as e:
                    output.append(f"  - (Error fetching translations: {e})")
            else:
                output.append("  - (No CILI mapping)")
                
        self.detail_text.delete("1.0", tk.END)
        self.detail_text.insert(tk.END, "\n".join(output))

if __name__ == "__main__":
    app = VocabBrowserApp()
    app.mainloop()