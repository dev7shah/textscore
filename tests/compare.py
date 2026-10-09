import urllib.request
import json
import subprocess
import textstat
import textwrap

texts = {
    "Children's Story": """Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?' So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.""",
    
    "News Article": """The city council announced a new initiative to repave all downtown roads starting next Monday. The project, estimated to cost $2.4 million, aims to improve traffic flow and reduce vehicle wear and tear. Mayor Smith stated that the construction will be phased to minimize disruptions to local businesses and commuters. 'This is a long overdue investment in our city's infrastructure,' Smith told reporters. Funding will be drawn from the municipal reserve fund, which was bolstered by higher-than-expected tax revenues last quarter.""",
    
    "Fiction w/ Dialogue": """Mr. Bennet was among the earliest of those who waited on Mr. Bingley. He had always intended to visit him, though to the last always assuring his wife that he should not go; and till the evening after the visit was paid she had no knowledge of it. It was then disclosed in the following manner. Observing his second daughter employed in trimming a hat, he suddenly addressed her with:
'I hope Mr. Bingley will like it, Lizzy.'
'We are not in a way to know what Mr. Bingley likes,' said her mother resentfully, 'since we are not to visit.'
'But you forget, mamma,' said Elizabeth, 'that we shall meet him at the assemblies, and that Mrs. Long promised to introduce him.'
'I do not believe Mrs. Long will do any such thing. She has two nieces of her own. She is a selfish, hypocritical woman, and I have no opinion of her.'
'No more have I,' said Mr. Bennet; 'and I am glad to find that you do not depend on her serving you.'""",

    "Legal Paragraph": """This License applies to any program or other work which contains a notice placed by the copyright holder saying it may be distributed under the terms of this General Public License. The "Program", below, refers to any such program or work, and a "work based on the Program" means either the Program or any derivative work under copyright law: that is to say, a work containing the Program or a portion of it, either verbatim or with modifications and/or translated into another language. (Hereinafter, translation is included without limitation in the term "modification".) Each licensee is addressed as "you".""",

    "Academic Abstract": """In this paper, we propose a novel framework for the scalable processing of multidimensional data. By exploiting the inherent sparsity of the datasets, our algorithm achieves a significant reduction in computational overhead while maintaining high accuracy. Theoretical analysis demonstrates that the time complexity is bounded by O(N log N) under reasonable assumptions regarding data distribution. Empirical evaluation on standard benchmarks corroborates our analytical findings, showing an average speedup of 3.4x over state-of-the-art methods. We conclude with a discussion on potential applications in large-scale machine learning pipelines and directions for future research."""
}

# Fetch ~5,000 words from a public domain text (Pride and Prejudice)
print("Downloading 5,000 word chapter...")
url = "https://www.gutenberg.org/files/1342/1342-0.txt"
try:
    req = urllib.request.urlopen(url)
    text = req.read().decode('utf-8')
    # Find start of chapter 1
    start_idx = text.find("Chapter 1")
    if start_idx == -1:
        start_idx = text.find("Chapter I")
    
    # Take a big chunk and slice to ~5000 words
    words = text[start_idx:start_idx+50000].split()
    long_text = ' '.join(words[:5000])
    texts["5,000 Word Chapter"] = long_text
except Exception as e:
    print("Failed to download large text, using a placeholder loop.", e)
    texts["5,000 Word Chapter"] = (texts["Fiction w/ Dialogue"] + " ") * 40

def get_node_stats(text):
    process = subprocess.Popen(['node', 'tests/cli.js'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = process.communicate(input=text.encode('utf-8'))
    if process.returncode != 0:
        raise Exception(f"Node script failed: {stderr.decode('utf-8')}")
    return json.loads(stdout.decode('utf-8'))

print("\nRunning comparison...")
print(f"{'Text Type':<20} | {'Metric':<20} | {'textstat':<10} | {'Readability.js':<14} | {'Diff':<10}")
print("-" * 83)

metrics = [
    ("Words", "word_count"),
    ("Sentences", "sentence_count"),
    ("Syllables", "syllable_count"),
    ("Flesch Reading Ease", "flesch_reading_ease"),
    ("Flesch-Kincaid", "flesch_kincaid_grade"),
    ("Gunning Fog", "gunning_fog"),
    ("Coleman-Liau", "coleman_liau_index"),
    ("ARI", "ari")
]

all_diffs = []

for name, content in texts.items():
    print(f"\n{name}")
    ts_stats = {
        "word_count": textstat.lexicon_count(content, removepunct=True),
        "sentence_count": textstat.sentence_count(content),
        "syllable_count": textstat.syllable_count(content),
        "flesch_reading_ease": textstat.flesch_reading_ease(content),
        "flesch_kincaid_grade": textstat.flesch_kincaid_grade(content),
        "gunning_fog": textstat.gunning_fog(content),
        "coleman_liau_index": textstat.coleman_liau_index(content),
        "ari": textstat.automated_readability_index(content)
    }
    
    js_stats = get_node_stats(content)
    
    for metric_name, key in metrics:
        ts_val = ts_stats[key]
        js_val = js_stats[key]
        diff = abs(ts_val - js_val)
        all_diffs.append(diff)
        
        warn = ""
        # Accept difference of up to 1.0 grade or 5 points of RE
        if key == "flesch_reading_ease":
            tolerance = 5.0
        elif key in ["word_count", "sentence_count", "syllable_count"]:
            tolerance = float('inf') # Don't flag these with ***
        else:
            tolerance = 1.0
            
        if diff > tolerance:
            warn = "***"
            
        print(f"{'':<20} | {metric_name:<20} | {ts_val:<10.2f} | {js_val:<14.2f} | {diff:<6.2f} {warn}")

max_diff = max(all_diffs)
print(f"\nMaximum difference across all metrics: {max_diff:.2f}")
