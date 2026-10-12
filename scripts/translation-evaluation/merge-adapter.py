"""Merge a local experimental adapter for subsequent ONNX evaluation only."""
import argparse
from pathlib import Path
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from peft import PeftModel
parser=argparse.ArgumentParser()
parser.add_argument('adapter');parser.add_argument('destination')
args=parser.parse_args();torch.set_num_threads(2)
model_id='megalaa/coptic-english-translator';revision='c5ccdb3aabb93c9962a0ae6d7305abfe8895d91d'
base=AutoModelForSeq2SeqLM.from_pretrained(model_id,revision=revision)
model=PeftModel.from_pretrained(base,args.adapter).merge_and_unload(safe_merge=True)
model.save_pretrained(args.destination,safe_serialization=True)
AutoTokenizer.from_pretrained(model_id,revision=revision).save_pretrained(args.destination)
print('Merged adapter for evaluation:',args.destination)
