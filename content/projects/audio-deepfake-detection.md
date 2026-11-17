---
title: Deepfake Audio Classification using Vision Transformers
summary: Master's thesis project at the IT University of Copenhagen that fine-tunes the Audio Spectrogram Transformer (AST) and a Vision Transformer (ViT) to detect deepfake speech, then tests how well they generalise to unseen datasets.
period: 2025
featured: false
order: 2
---

## Summary

A two-person master's thesis in Computer Science at the IT University of Copenhagen on detecting deepfake speech. The thesis fine-tunes two Transformer models, the Audio Spectrogram Transformer (AST) and a Vision Transformer (ViT), to classify spectrograms of speech as real or fake. It then tests whether a detector trained on one dataset still works on deepfakes from other sources, which real-world use requires. Generated speech is now hard to tell apart from real recordings, which makes audio deepfakes easy to use for fraud and other crimes.

## Stack

- Python and PyTorch for training and evaluation
- Hugging Face Transformers: fine-tuning the Audio Spectrogram Transformer (`MIT/ast-finetuned-audioset-10-10-0.4593`) as a bonafide/spoof classifier
- timm: fine-tuning a base Vision Transformer (`vit_base_patch16_224`) on spectrograms
- librosa: converting audio to 128-bin log-mel spectrograms
- scikit-learn: evaluation metrics, including equal error rate (EER), and t-SNE embedding plots
- Weights & Biases: experiment tracking, with figures for the report generated from the logged runs
- Slurm on the ITU HPC GPU cluster for training runs
- Datasets: ASVspoof 2021 DF, ADD 2023 track 1, and Fake-or-Real (FoR, 2-second version)

## My role

Two-person master's thesis for Computer Science. 
- spectrogram preprocessing and dataset loaders for three datasets
- fine-tuning both models: the AST had its first 10 layers frozen and its position embeddings interpolated for longer inputs, and the ViT had only its last blocks and classifier head trained
- cross-dataset benchmarking with EER
- attention maps and t-SNE plots of the learned embeddings
- inference on single audio clips

## Results

- Both models were fine-tuned on ASVspoof 2021 DF. On its validation set, the AST reached 99% accuracy with an EER of 0.75%, and the ViT reached 96.8% accuracy with an EER of 4.5%.
- On datasets the models had not seen in training, results were close to chance:
  - AST: EER of 45.3% on ADD and 56.3% on FoR
  - ViT: EER of 49.6% on ADD and 58.8% on FoR
- The thesis concludes that both models perform comparably to the state of the art on known data. Because they fail to generalise to unseen datasets, they are not ready for real-world use. Overfitting and the padding/cropping of spectrograms are discussed as likely causes, and attention maps were used to inspect how the models behave on heavily padded clips.
- The models were also tried on clips collected from the internet, including AI-generated speech, with accuracy that varied from clip to clip.
- Recieved grade: 12 (A)

## Links

- GitHub repository: https://github.com/carcasonne/Kandidat
