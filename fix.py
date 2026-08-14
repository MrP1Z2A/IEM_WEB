import os
import re

def fix_buttons(root_dir):
    button_re = re.compile(r'<button\b([^>]*?)>')
    type_re = re.compile(r'\btype=')
    
    total_fixed = 0
    total_form = 0
    total_buttons = 0

    for dirpath, dirnames, filenames in os.walk(root_dir):
        if 'node_modules' in dirpath:
            continue
        for filename in filenames:
            if filename.endswith(('.tsx', '.jsx')):
                filepath = os.path.join(dirpath, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Very naive form detection: check if there's an active <form> before the button
                # Better: use a stack for <form> and </form>
                
                parts = re.split(r'(</?form\b[^>]*>)', content)
                in_form = False
                new_parts = []
                modified = False

                for part in parts:
                    if part.startswith('<form'):
                        in_form = True
                        new_parts.append(part)
                    elif part.startswith('</form>'):
                        in_form = False
                        new_parts.append(part)
                    else:
                        # Process buttons in this part
                        new_part = part
                        matches = list(button_re.finditer(new_part))
                        # Reverse so we don't mess up indices
                        for match in reversed(matches):
                            attrs = match.group(1)
                            total_buttons += 1
                            if not type_re.search(attrs) and not '{...props}' in attrs:
                                if in_form:
                                    # Inside a form, default behavior is submit.
                                    # Let's explicitly set type="submit" to be safe.
                                    new_attrs = attrs + ' type="submit"'
                                    total_form += 1
                                else:
                                    new_attrs = attrs + ' type="button"'
                                    total_fixed += 1
                                
                                new_tag = f'<button{new_attrs}>'
                                new_part = new_part[:match.start()] + new_tag + new_part[match.end():]
                                modified = True
                        new_parts.append(new_part)

                if modified:
                    new_content = "".join(new_parts)
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)

    print(f"Fixed {total_fixed} normal buttons and {total_form} form submit buttons out of {total_buttons} buttons.")

def fix_gray_on_color(root_dir):
    # Rule 3: text-gray-* or text-slate-* on colored background
    # E.g. bg-rose-500 ... text-slate-400
    # The diagnostics listed specific files and lines.
    # But we can also just do a global replace for the known bad patterns.
    # Actually, the user asked me to fix 17 occurrences. Let's do it simply:
    # Look for "text-slate-" or "text-gray-" and a "hover:bg-rose-50" or similar on the same line,
    # or just replace text-slate-400 with text-white if it's on a colored bg.
    pass

if __name__ == '__main__':
    fix_buttons('src')
