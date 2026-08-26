import argparse
import base64
import sys
import io
import json
from markitdown import MarkItDown

try:
    from rapidocr_onnxruntime import RapidOCR
except ImportError:
    RapidOCR = None


class LocalOCRCompletions:
    def __init__(self, ocr_engine):
        self.ocr = ocr_engine

    def create(self, model, messages):
        ocr_text = ""
        for message in messages:
            if isinstance(message.get("content"), list):
                for item in message["content"]:
                    if item.get("type") == "image_url":
                        url = item["image_url"]["url"]
                        if url.startswith("data:image/"):
                            try:
                                header, encoded = url.split(",", 1)
                                image_data = base64.b64decode(encoded)
                                if self.ocr is not None:
                                    result, _ = self.ocr(image_data)
                                    if result:
                                        extracted = "\n".join([box[1] for box in result])
                                        ocr_text += extracted + "\n"
                            except Exception as e:
                                print(f"OCR Error: {e}", file=sys.stderr)

        if not ocr_text.strip():
            ocr_text = "[Image with no detectable text]"

        class Choice:
            def __init__(self, text):
                self.message = type('Message', (), {'content': text})()

        class Response:
            def __init__(self, text):
                self.choices = [Choice(text)]

        return Response(ocr_text)


class LocalOCRChat:
    def __init__(self, ocr_engine):
        self.completions = LocalOCRCompletions(ocr_engine)


class LocalOCRClient:
    """Mock OpenAI Client that intercepts image requests and uses local RapidOCR."""
    def __init__(self):
        if RapidOCR is None:
            print("Warning: rapidocr_onnxruntime is not installed. OCR will be skipped.", file=sys.stderr)
            self.ocr = None
        else:
            self.ocr = RapidOCR()

        self.chat = LocalOCRChat(self.ocr)


import re

def auto_format_headings(text):
    """如果纯 OCR 输出没有任何 Markdown 标题，则尝试通过正则启发式还原目录层级。"""
    if re.search(r'^#+ ', text, flags=re.MULTILINE):
        return text

    lines = text.split('\n')
    new_lines = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if i < 5 and (stripped.endswith("协议") or stripped.endswith("合同")):
            new_lines.append("# " + line)
        elif stripped in ["特别提醒", "通用条款"] or re.match(r'^附件\d+：?', stripped):
            new_lines.append("## " + line)
        elif re.match(r'^\d+、', stripped):
            new_lines.append("### " + line)
        elif re.match(r'^\d+\.\d+\.\d+([^\d]|$)', stripped):
            new_lines.append("##### " + line)
        elif re.match(r'^\d+\.\d+([^\d]|$)', stripped):
            new_lines.append("#### " + line)
        else:
            new_lines.append(line)

    return '\n'.join(new_lines)


# 代码块 fence 识别 (clean_md stage1 in_code 跟踪用)
_MD_FENCE = re.compile(r'^```')


def clean_md(text):
    """对 markitdown 产物做保守规则清洗, 去除 OCR/PDF 噪声, 不做段内合并。

    清洗规则 (保守, 忠实转换; 段内合并/段落重建/模板化交给下游 md-structure skill):
      1. 固定水印串 (招聘平台简历水印)
      2. 单独成行的重复长数字串 (重复电话/ID, 保留首次)
      3. PDF 装饰图形被 OCR 误识别的连续单字符行块 (≥3 行丢弃)
      4. 代码块 fence 原样透传 (保留缩进/空行)
      5. 空行压缩 (≥2 空行 -> 1 空行)

    边界 (规则不做, 交 md-structure / 下游 agent):
      - 段内换行合并 / 段落重建 / spaced-CJK 合并 / bullet 归一化
      - 章节归属错位 / 字段结构化 / OCR 字符重排
    """
    # 规则 1: 去水印
    text = re.sub(r'a2d17f6ede7c0f4d[A-Za-z0-9_~-]*~~', '', text)

    lines = text.split('\n')
    stage1 = []
    seen_long_digit = set()
    single_char_run = []
    in_code = False

    def is_single_char_noise(s):
        """散乱单字符噪声: 非空、stripped 长度<=2、非句末标点。"""
        s = s.strip()
        if not s or len(s) > 2:
            return False
        if s in {'。', '！', '？', '.', '!', '?', '，', ','}:
            return False
        return True

    def is_long_digit_line(s):
        """长数字/电话类行: 仅由数字/横线/空格组成且长度>=8。"""
        s = s.strip()
        if len(s) < 8:
            return False
        return all(ch.isdigit() or ch in '- 　' for ch in s)

    def flush_run():
        """连续单字符行 >=3 丢弃, <3 保留。"""
        if len(single_char_run) >= 3:
            single_char_run.clear()
            return
        stage1.extend(single_char_run)
        single_char_run.clear()

    for line in lines:
        s = line.strip()
        # 代码块: fence 与代码内容原样保留, 不做噪声清洗
        if _MD_FENCE.match(s):
            in_code = not in_code
            flush_run()
            stage1.append(line)
            continue
        if in_code:
            flush_run()
            stage1.append(line)
            continue
        if not s:
            if single_char_run:
                continue
            stage1.append('')
            continue
        if is_single_char_noise(s):
            single_char_run.append(s)
            continue
        flush_run()
        # 规则 2: 重复长数字去重
        if is_long_digit_line(s):
            if s in seen_long_digit:
                continue
            seen_long_digit.add(s)
        stage1.append(s)
    flush_run()

    # 空行压缩 (≥2 空行 -> 1 空行)
    cleaned = '\n'.join(stage1)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned.strip() + '\n'

def main():
    parser = argparse.ArgumentParser(description="Convert documents to Markdown using MarkItDown and Local OCR.")
    parser.add_argument("input_file", help="Path to the input file (e.g., PDF, DOCX, PPTX)")
    parser.add_argument("-o", "--output", help="Path to save the output Markdown file", default=None)
    args = parser.parse_args()

    print(f"Processing {args.input_file} with local OCR...", file=sys.stderr)

    md = MarkItDown(
        llm_client=LocalOCRClient(),
        llm_model="local-ocr-model"
    )

    try:
        result = md.convert(args.input_file)
        text_content = result.text_content

        text_content = auto_format_headings(text_content)
        text_content = clean_md(text_content)

        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(text_content)
            print(f"Successfully converted to {args.output}", file=sys.stderr)
        else:
            print(text_content)

    except Exception as e:
        print(f"Failed to convert document: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
