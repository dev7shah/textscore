import json
import textstat
import subprocess

text = """In this paper, we propose a novel framework for the scalable processing of multidimensional data. By exploiting the inherent sparsity of the datasets, our algorithm achieves a significant reduction in computational overhead while maintaining high accuracy. Theoretical analysis demonstrates that the time complexity is bounded by O(N log N) under reasonable assumptions regarding data distribution. Empirical evaluation on standard benchmarks corroborates our analytical findings, showing an average speedup of 3.4x over state-of-the-art methods. We conclude with a discussion on potential applications in large-scale machine learning pipelines and directions for future research."""

words = text.split()
for w in words:
    clean_w = ''.join(c for c in w if c.isalpha())
    if not clean_w:
        continue
    ts = textstat.syllable_count(clean_w)
    
    # run node for just this word
    process = subprocess.Popen(['node', '-e', f"var R = require('./readability.js'); console.log(R.countSyllables('{clean_w}'));"], stdout=subprocess.PIPE)
    out, _ = process.communicate()
    js = int(out.decode('utf-8').strip())
    
    if ts != js:
        print(f"{clean_w}: textstat={ts}, readability={js}")
