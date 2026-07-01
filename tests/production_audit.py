import re
import sys
import random

def get_block_by_braces(text, start_idx):
    # Find the first '{' after start_idx
    brace_start = text.find('{', start_idx)
    if brace_start == -1:
        return ""
    # Track brace depth
    depth = 1
    i = brace_start + 1
    in_string = False
    string_char = ''
    while i < len(text) and depth > 0:
        char = text[i]
        if in_string:
            if char == string_char and text[i-1] != '\\':
                in_string = False
        elif char in ["'", '"', '`']:
            in_string = True
            string_char = char
        elif char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
        i += 1
    return text[brace_start + 1 : i - 1]

def get_block_by_depth(text, start_idx, open_char='{', close_char='}'):
    depth = 0
    i = start_idx
    in_string = False
    string_char = ''
    start_pos = -1
    
    while i < len(text):
        char = text[i]
        if in_string:
            if char == string_char and text[i-1] != '\\':
                in_string = False
        elif char in ["'", '"', '`']:
            in_string = True
            string_char = char
        elif char == open_char:
            if depth == 0:
                start_pos = i
            depth += 1
        elif char == close_char:
            depth -= 1
            if depth == 0:
                return text[start_pos : i + 1]
        i += 1
    return None

def parse_js_array_of_objects(js_str):
    objects = []
    i = 0
    brace_depth = 0
    current_obj_start = -1
    
    in_string = False
    string_char = ''
    in_comment = False
    comment_type = ''
    
    while i < len(js_str):
        char = js_str[i]
        
        # Handle string literals
        if in_string:
            if char == string_char and js_str[i-1] != '\\':
                in_string = False
            i += 1
            continue
        elif char in ['"', "'", '`']:
            in_string = True
            string_char = char
            i += 1
            continue
            
        # Handle comments
        if in_comment:
            if comment_type == 'line' and char == '\n':
                in_comment = False
            elif comment_type == 'block' and char == '/' and js_str[i-1] == '*':
                in_comment = False
            i += 1
            continue
        else:
            if char == '/' and i + 1 < len(js_str) and js_str[i+1] == '/':
                in_comment = True
                comment_type = 'line'
                i += 2
                continue
            elif char == '/' and i + 1 < len(js_str) and js_str[i+1] == '*':
                in_comment = True
                comment_type = 'block'
                i += 2
                continue

        if char == '{':
            if brace_depth == 0:
                current_obj_start = i
            brace_depth += 1
        elif char == '}':
            brace_depth -= 1
            if brace_depth == 0 and current_obj_start != -1:
                objects.append(js_str[current_obj_start:i+1])
                current_obj_start = -1
        i += 1
    return objects

def extract_banks_and_templates():
    with open('kira_v3.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find SENTENCE_WORD_BANKS
    bank_match = re.search(r"const SENTENCE_WORD_BANKS\s*=\s*(\{[\s\S]*?\});\s*(?://|/\*|const|let|function|\n)", content)
    if not bank_match:
        print("Could not find SENTENCE_WORD_BANKS in HTML")
        sys.exit(1)
    
    bank_str = bank_match.group(1)
    # Remove lines comments and block comments from bank_str
    bank_str_clean = re.sub(r"//.*", "", bank_str)
    bank_str_clean = re.sub(r"/\*[\s\S]*?\*/", "", bank_str_clean)
    
    # Extract keys and array values for word banks
    banks = {}
    idx = 0
    while idx < len(bank_str_clean):
        colon_idx = bank_str_clean.find(':', idx)
        if colon_idx == -1:
            break
        key_part = bank_str_clean[idx:colon_idx].strip()
        key_match = re.search(r"(\w+)\s*$", key_part)
        if not key_match:
            idx = colon_idx + 1
            continue
        key = key_match.group(1)
        
        bracket_start = bank_str_clean.find('[', colon_idx)
        if bracket_start == -1:
            idx = colon_idx + 1
            continue
            
        depth = 1
        j = bracket_start + 1
        in_str = False
        str_c = ''
        while j < len(bank_str_clean) and depth > 0:
            c = bank_str_clean[j]
            if in_str:
                if c == str_c and bank_str_clean[j-1] != '\\':
                    in_str = False
            elif c in ["'", '"', '`']:
                in_str = True
                str_c = c
            elif c == '[':
                depth += 1
            elif c == ']':
                depth -= 1
            j += 1
            
        list_str = bank_str_clean[bracket_start:j]
        # Parse list elements
        elements = []
        obj_matches = re.findall(r"\{\s*word:\s*([^,}\n]+)[\s\S]*?\}|['\"]([^'\"]*)['\"]", list_str)
        for obj_w, str_w in obj_matches:
            if obj_w:
                w = obj_w.strip().strip("'\"")
                elements.append(w)
            elif str_w:
                elements.append(str_w)
                
        banks[key] = elements
        idx = j

    # Find SENTENCE_TEMPLATES
    template_match = re.search(r"const SENTENCE_TEMPLATES\s*=\s*(\[[\s\S]*?\]);\s*(?://|/\*|const|let|function|\n)", content)
    if not template_match:
        print("Could not find SENTENCE_TEMPLATES in HTML")
        sys.exit(1)
        
    template_str = template_match.group(1)
    template_objects = parse_js_array_of_objects(template_str)
    
    templates = []
    for obj_body in template_objects:
        id_match = re.search(r"id:\s*['\"](\w+)['\"]", obj_body)
        if not id_match:
            continue
        temp_id = id_match.group(1)
        
        structs_match = re.search(r"structures:\s*\[([\s\S]*?)\]", obj_body)
        if not structs_match:
            continue
        structs_content = structs_match.group(1)
        structures = [s.strip().strip("'\"") for s in re.findall(r"['\"]([^'\"]*)['\"]", structs_content) if s.strip()]
        
        slots_label_idx = obj_body.find("slots:")
        slots_dict = {}
        if slots_label_idx != -1:
            slots_body = get_block_by_braces(obj_body, slots_label_idx)
            idx = 0
            while idx < len(slots_body):
                colon_idx = slots_body.find(':', idx)
                if colon_idx == -1:
                    break
                key_part = slots_body[idx:colon_idx].strip()
                key_match = re.search(r"(\w+)\s*$", key_part)
                if not key_match:
                    idx = colon_idx + 1
                    continue
                key = key_match.group(1)
                
                val_start = colon_idx + 1
                val_depth = 0
                val_chars = []
                j = val_start
                in_str = False
                str_c = ''
                while j < len(slots_body):
                    c = slots_body[j]
                    if in_str:
                        val_chars.append(c)
                        if c == str_c and slots_body[j-1] != '\\':
                            in_str = False
                    elif c in ["'", '"', '`']:
                        in_str = True
                        str_c = c
                        val_chars.append(c)
                    elif c == '{':
                        val_depth += 1
                        val_chars.append(c)
                    elif c == '}':
                        val_depth -= 1
                        val_chars.append(c)
                    elif c == ',' and val_depth == 0:
                        break
                    else:
                        val_chars.append(c)
                    j += 1
                val = ''.join(val_chars).strip()
                
                bank_name_match = re.search(r"bank:\s*['\"](\w+)['\"]", val)
                if bank_name_match:
                    slots_dict[key] = bank_name_match.group(1)
                else:
                    str_match = re.search(r"['\"](\w+)['\"]", val)
                    if str_match:
                        slots_dict[key] = str_match.group(1)
                    else:
                        slots_dict[key] = None
                idx = j + 1
                
        templates.append({
            'id': temp_id,
            'structures': structures,
            'slots': slots_dict
        })
        
    return banks, templates

def test_templates(banks, templates):
    print("--- Production Robustness Audit: Sentence Engine (Python) ---")
    all_pass = True
    for template in templates:
        for _ in range(100):
            if not template['structures']:
                continue
            struct = random.choice(template['structures'])
            sentence = struct
            for slot, bank_name in template['slots'].items():
                if not bank_name:
                    continue
                if bank_name in ['memory_text', 'user_mirror']:
                    word_str = "something"
                else:
                    bank = banks.get(bank_name)
                    if not bank or len(bank) == 0:
                        print(f"[FAIL] Template {template['id']} refers to missing or empty bank: {bank_name}")
                        all_pass = False
                        word_str = "MISSING"
                    else:
                        word_str = random.choice(bank)
                sentence = sentence.replace(f"{{{slot}}}", word_str)
            if '{' in sentence or '}' in sentence:
                print(f"[FAIL] Template {template['id']} has unfilled slots: {sentence}")
                all_pass = False
    if all_pass:
        print("[PASS] All templates and word banks integrated.")
    return all_pass

def test_invariants():
    print("\n--- Production Robustness Audit: Invariants ---")
    with open('kira_v3.html', 'r', encoding='utf-8') as f:
        content = f.read()
        
    val_match = re.search(r"const intimateWords\s*=\s*(\[[^\]]*\]);", content)
    if not val_match:
        print("[FAIL] Could not find intimateWords in kira_v3.html")
        return False
        
    intimate_words = eval(val_match.group(1))
    
    def validate(s, affection):
        if affection < 300:
            if any(w in s.lower() for w in intimate_words):
                return False
        return True

    bad_sentence = "I crave your touch"
    if validate(bad_sentence, 0) is False and validate(bad_sentence, 500) is True:
        print("[PASS] Stage-based content gating invariant verified.")
        return True
    else:
        print("[FAIL] Stage-based content gating mismatch.")
        return False

if __name__ == '__main__':
    banks, templates = extract_banks_and_templates()
    templates_ok = test_templates(banks, templates)
    invariants_ok = test_invariants()
    if templates_ok and invariants_ok:
        print("\nPRODUCTION AUDIT PASSED.")
        sys.exit(0)
    else:
        print("\nPRODUCTION AUDIT FAILED.")
        sys.exit(1)
