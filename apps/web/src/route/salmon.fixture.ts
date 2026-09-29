// The Salmon route as `GET /api/routes` really answers it, captured from the fixtures' index:
//
//   uv run python apps/api/manage.py rebuild_index --root tests/fixtures/salmon
//   curl -s "http://127.0.0.1:8090/api/routes?goal=salmon"
//
// The layout is tested against what the API answers, not against a shape we imagined (M3P4.5).
import type { RouteOut } from "../api/schema";

export const SALMON: RouteOut = {
  goals: ["salmon"],
  known: [],
  stops: [
    {
      id: "dna-and-genes",
      title: "DNA and genes",
      claim:
        "DNA is a long molecule written in four letters, and a gene is a stretch of it that a cell reads to make something.",
      level: "first-steps",
      minutes: 10,
      region: {
        id: "molecular-biology",
        name: "Molecular biology",
      },
      needed_by: [
        {
          id: "gene-expression",
          title: "Gene expression",
          level: "first-steps",
          reason: "Expression is a gene being read, so it starts from what a gene is.",
        },
        {
          id: "short-read-sequencing",
          title: "Short-read sequencing",
          level: "first-steps",
          reason: "A sequencer reads DNA's letters, so it starts from what DNA is.",
        },
        {
          id: "k-mers",
          title: "k-mers",
          level: "foundations",
          reason: "k-mers are words cut from DNA sequences.",
        },
        {
          id: "sequence-alignment",
          title: "Sequence alignment and scores",
          level: "foundations",
          reason: "Alignment compares DNA sequences letter by letter.",
        },
      ],
    },
    {
      id: "gene-expression",
      title: "Gene expression",
      claim:
        "A gene is expressed when a cell copies it into RNA, and cells differ in which genes they express and how much.",
      level: "first-steps",
      minutes: 10,
      region: {
        id: "molecular-biology",
        name: "Molecular biology",
      },
      needed_by: [
        {
          id: "splicing",
          title: "Splicing",
          level: "foundations",
          reason: "Splicing happens to the RNA a gene is copied into.",
        },
        {
          id: "rna-seq-libraries",
          title: "RNA-seq reads and libraries",
          level: "foundations",
          reason:
            "RNA-seq measures expression, so the RNA it reads comes from genes being expressed.",
        },
      ],
    },
    {
      id: "splicing",
      title: "Splicing",
      claim:
        "Splicing cuts the introns out of a new RNA and joins its exons, and different choices of exons give different RNAs from one gene.",
      level: "foundations",
      minutes: 10,
      region: {
        id: "molecular-biology",
        name: "Molecular biology",
      },
      needed_by: [
        {
          id: "transcripts-and-isoforms",
          title: "Transcripts and isoforms",
          level: "foundations",
          reason: "Isoforms exist because splicing can join a gene's exons in different ways.",
        },
      ],
    },
    {
      id: "transcripts-and-isoforms",
      title: "Transcripts and isoforms",
      claim:
        "A transcript is one RNA a gene can produce, and a gene's isoforms are its different transcripts, which often share most of their exons.",
      level: "foundations",
      minutes: 10,
      region: {
        id: "molecular-biology",
        name: "Molecular biology",
      },
      needed_by: [
        {
          id: "multi-mapping-reads",
          title: "Reads that map to several places",
          level: "introductory",
          reason: "Isoforms share exons, so a read from a shared exon fits all of them.",
        },
        {
          id: "tpm",
          title: "What TPM measures",
          level: "introductory",
          reason: "TPM is measured per transcript.",
        },
        {
          id: "salmon",
          title: "Salmon",
          level: "intermediate",
          reason: "Salmon estimates abundance per transcript, and isoforms are why that is hard.",
        },
      ],
    },
    {
      id: "short-read-sequencing",
      title: "Short-read sequencing",
      claim:
        "A short-read sequencer reads millions of short fragments of DNA at once and reports each one as a string of letters.",
      level: "first-steps",
      minutes: 10,
      region: {
        id: "sequencing",
        name: "Sequencing",
      },
      needed_by: [
        {
          id: "fastq-and-quality-scores",
          title: "FASTQ and quality scores",
          level: "first-steps",
          reason: "FASTQ is how a sequencer's reads are written down.",
        },
        {
          id: "rna-seq-libraries",
          title: "RNA-seq reads and libraries",
          level: "foundations",
          reason: "RNA-seq reads are short reads from a sequencer.",
        },
        {
          id: "read-mapping",
          title: "Mapping reads to a reference",
          level: "introductory",
          reason: "Mapping places the short reads a sequencer produces.",
        },
      ],
    },
    {
      id: "fastq-and-quality-scores",
      title: "FASTQ and quality scores",
      claim:
        "A FASTQ file stores each read in four lines, a name, the letters, a separator and a quality score for each letter.",
      level: "first-steps",
      minutes: 8,
      region: {
        id: "sequencing",
        name: "Sequencing",
      },
      needed_by: [
        {
          id: "rna-seq-libraries",
          title: "RNA-seq reads and libraries",
          level: "foundations",
          reason: "RNA-seq reads arrive as FASTQ files.",
        },
      ],
    },
    {
      id: "rna-seq-libraries",
      title: "RNA-seq reads and libraries",
      claim:
        "RNA-seq turns a sample's RNA into a library of DNA fragments and sequences them, so the reads are a sample of the RNA it held.",
      level: "foundations",
      minutes: 12,
      region: {
        id: "sequencing",
        name: "Sequencing",
      },
      needed_by: [
        {
          id: "tpm",
          title: "What TPM measures",
          level: "introductory",
          reason: "TPM is estimated from the reads a library produces.",
        },
        {
          id: "salmon",
          title: "Salmon",
          level: "intermediate",
          reason:
            "Salmon's input is the reads of an RNA-seq library, and it must know the library's type.",
        },
      ],
    },
    {
      id: "k-mers",
      title: "k-mers",
      claim:
        "The k-mers of a sequence are all its substrings of length k, and they let a computer find shared sequence by looking words up.",
      level: "foundations",
      minutes: 8,
      region: {
        id: "sequence-analysis",
        name: "Sequence analysis",
      },
      needed_by: [
        {
          id: "read-mapping",
          title: "Mapping reads to a reference",
          level: "introductory",
          reason: "Mappers find candidate places by looking up a read's k-mers.",
        },
      ],
    },
    {
      id: "sequence-alignment",
      title: "Sequence alignment and scores",
      claim:
        "An alignment lines two sequences up, allowing gaps, and its score says how good the match is.",
      level: "foundations",
      minutes: 12,
      region: {
        id: "sequence-analysis",
        name: "Sequence analysis",
      },
      needed_by: [
        {
          id: "read-mapping",
          title: "Mapping reads to a reference",
          level: "introductory",
          reason: "Mappers check each candidate place with an alignment score.",
        },
      ],
    },
    {
      id: "read-mapping",
      title: "Mapping reads to a reference",
      claim:
        "Mapping finds where in a reference each read could have come from, by looking up its k-mers and checking the candidate places with an alignment.",
      level: "introductory",
      minutes: 12,
      region: {
        id: "sequence-analysis",
        name: "Sequence analysis",
      },
      needed_by: [
        {
          id: "multi-mapping-reads",
          title: "Reads that map to several places",
          level: "introductory",
          reason: "A read maps to several places when mapping finds more than one good match.",
        },
        {
          id: "salmon",
          title: "Salmon",
          level: "intermediate",
          reason: "Salmon first finds which transcripts each read could have come from.",
        },
      ],
    },
    {
      id: "multi-mapping-reads",
      title: "Reads that map to several places",
      claim:
        "Many RNA-seq reads fit several transcripts equally well, so counting reads per transcript means deciding how to share them out.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "sequence-analysis",
        name: "Sequence analysis",
      },
      needed_by: [
        {
          id: "salmon",
          title: "Salmon",
          level: "intermediate",
          reason:
            "Most of Salmon's work is deciding where reads that fit several transcripts belong.",
        },
      ],
    },
    {
      id: "probability",
      title: "Probability",
      claim:
        "A probability is a number from 0 to 1 that says how likely something is, and the probabilities of all the possible outcomes add up to 1.",
      level: "first-steps",
      minutes: 10,
      region: {
        id: "statistics",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "likelihood",
          title: "Likelihood",
          level: "foundations",
          reason: "Likelihood is the probability of the data under a model.",
        },
      ],
    },
    {
      id: "likelihood",
      title: "Likelihood",
      claim:
        "The likelihood of a model is how probable it makes the data you actually saw, and the best-fitting model is the one with the highest likelihood.",
      level: "foundations",
      minutes: 10,
      region: {
        id: "statistics",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "mixture-models",
          title: "Mixture models",
          level: "introductory",
          reason:
            "A mixture model is fitted by finding the proportions with the highest likelihood.",
        },
      ],
    },
    {
      id: "mixture-models",
      title: "Mixture models",
      claim:
        "A mixture model says each observation came from one of several sources in unknown proportions, and fitting it estimates those proportions.",
      level: "introductory",
      minutes: 12,
      region: {
        id: "statistics",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "em-algorithm",
          title: "The EM algorithm",
          level: "intermediate",
          reason:
            "EM is the standard way to fit a mixture model when the source of each observation is hidden.",
        },
      ],
    },
    {
      id: "em-algorithm",
      title: "The EM algorithm",
      claim:
        "The EM algorithm fits a mixture model by alternating two steps, sharing each observation among the sources by the current estimate and then re-estimating the proportions from those shares.",
      level: "intermediate",
      minutes: 15,
      region: {
        id: "statistics",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "salmon",
          title: "Salmon",
          level: "intermediate",
          reason: "Salmon shares ambiguous reads among transcripts with EM.",
        },
      ],
    },
    {
      id: "tpm",
      title: "What TPM measures",
      claim:
        "TPM, transcripts per million, is each transcript's share of the transcript molecules in a sample, scaled so the shares add up to a million.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "transcriptomics",
        name: "Transcriptomics",
      },
      needed_by: [
        {
          id: "salmon",
          title: "Salmon",
          level: "intermediate",
          reason: "Salmon reports each transcript's abundance in TPM.",
        },
      ],
    },
    {
      id: "salmon",
      title: "Salmon",
      claim:
        "Salmon estimates how much of each transcript a sample holds by mapping RNA-seq reads to the transcriptome and resolving reads that fit several transcripts with a probabilistic model.",
      level: "intermediate",
      minutes: 15,
      region: {
        id: "transcriptomics",
        name: "Transcriptomics",
      },
      needed_by: [],
    },
  ],
  span: {
    lowest: "first-steps",
    highest: "intermediate",
  },
  minutes: 184,
};

export const SALMON_KNOWN: RouteOut = {
  goals: ["salmon"],
  known: ["read-mapping"],
  stops: [
    {
      id: "dna-and-genes",
      title: "DNA and genes",
      claim:
        "DNA is a long molecule written in four letters, and a gene is a stretch of it that a cell reads to make something.",
      level: "first-steps",
      minutes: 10,
      region: {
        id: "molecular-biology",
        name: "Molecular biology",
      },
      needed_by: [
        {
          id: "gene-expression",
          title: "Gene expression",
          level: "first-steps",
          reason: "Expression is a gene being read, so it starts from what a gene is.",
        },
        {
          id: "short-read-sequencing",
          title: "Short-read sequencing",
          level: "first-steps",
          reason: "A sequencer reads DNA's letters, so it starts from what DNA is.",
        },
      ],
    },
    {
      id: "gene-expression",
      title: "Gene expression",
      claim:
        "A gene is expressed when a cell copies it into RNA, and cells differ in which genes they express and how much.",
      level: "first-steps",
      minutes: 10,
      region: {
        id: "molecular-biology",
        name: "Molecular biology",
      },
      needed_by: [
        {
          id: "splicing",
          title: "Splicing",
          level: "foundations",
          reason: "Splicing happens to the RNA a gene is copied into.",
        },
        {
          id: "rna-seq-libraries",
          title: "RNA-seq reads and libraries",
          level: "foundations",
          reason:
            "RNA-seq measures expression, so the RNA it reads comes from genes being expressed.",
        },
      ],
    },
    {
      id: "splicing",
      title: "Splicing",
      claim:
        "Splicing cuts the introns out of a new RNA and joins its exons, and different choices of exons give different RNAs from one gene.",
      level: "foundations",
      minutes: 10,
      region: {
        id: "molecular-biology",
        name: "Molecular biology",
      },
      needed_by: [
        {
          id: "transcripts-and-isoforms",
          title: "Transcripts and isoforms",
          level: "foundations",
          reason: "Isoforms exist because splicing can join a gene's exons in different ways.",
        },
      ],
    },
    {
      id: "transcripts-and-isoforms",
      title: "Transcripts and isoforms",
      claim:
        "A transcript is one RNA a gene can produce, and a gene's isoforms are its different transcripts, which often share most of their exons.",
      level: "foundations",
      minutes: 10,
      region: {
        id: "molecular-biology",
        name: "Molecular biology",
      },
      needed_by: [
        {
          id: "multi-mapping-reads",
          title: "Reads that map to several places",
          level: "introductory",
          reason: "Isoforms share exons, so a read from a shared exon fits all of them.",
        },
        {
          id: "tpm",
          title: "What TPM measures",
          level: "introductory",
          reason: "TPM is measured per transcript.",
        },
        {
          id: "salmon",
          title: "Salmon",
          level: "intermediate",
          reason: "Salmon estimates abundance per transcript, and isoforms are why that is hard.",
        },
      ],
    },
    {
      id: "short-read-sequencing",
      title: "Short-read sequencing",
      claim:
        "A short-read sequencer reads millions of short fragments of DNA at once and reports each one as a string of letters.",
      level: "first-steps",
      minutes: 10,
      region: {
        id: "sequencing",
        name: "Sequencing",
      },
      needed_by: [
        {
          id: "fastq-and-quality-scores",
          title: "FASTQ and quality scores",
          level: "first-steps",
          reason: "FASTQ is how a sequencer's reads are written down.",
        },
        {
          id: "rna-seq-libraries",
          title: "RNA-seq reads and libraries",
          level: "foundations",
          reason: "RNA-seq reads are short reads from a sequencer.",
        },
      ],
    },
    {
      id: "fastq-and-quality-scores",
      title: "FASTQ and quality scores",
      claim:
        "A FASTQ file stores each read in four lines, a name, the letters, a separator and a quality score for each letter.",
      level: "first-steps",
      minutes: 8,
      region: {
        id: "sequencing",
        name: "Sequencing",
      },
      needed_by: [
        {
          id: "rna-seq-libraries",
          title: "RNA-seq reads and libraries",
          level: "foundations",
          reason: "RNA-seq reads arrive as FASTQ files.",
        },
      ],
    },
    {
      id: "rna-seq-libraries",
      title: "RNA-seq reads and libraries",
      claim:
        "RNA-seq turns a sample's RNA into a library of DNA fragments and sequences them, so the reads are a sample of the RNA it held.",
      level: "foundations",
      minutes: 12,
      region: {
        id: "sequencing",
        name: "Sequencing",
      },
      needed_by: [
        {
          id: "tpm",
          title: "What TPM measures",
          level: "introductory",
          reason: "TPM is estimated from the reads a library produces.",
        },
        {
          id: "salmon",
          title: "Salmon",
          level: "intermediate",
          reason:
            "Salmon's input is the reads of an RNA-seq library, and it must know the library's type.",
        },
      ],
    },
    {
      id: "multi-mapping-reads",
      title: "Reads that map to several places",
      claim:
        "Many RNA-seq reads fit several transcripts equally well, so counting reads per transcript means deciding how to share them out.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "sequence-analysis",
        name: "Sequence analysis",
      },
      needed_by: [
        {
          id: "salmon",
          title: "Salmon",
          level: "intermediate",
          reason:
            "Most of Salmon's work is deciding where reads that fit several transcripts belong.",
        },
      ],
    },
    {
      id: "probability",
      title: "Probability",
      claim:
        "A probability is a number from 0 to 1 that says how likely something is, and the probabilities of all the possible outcomes add up to 1.",
      level: "first-steps",
      minutes: 10,
      region: {
        id: "statistics",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "likelihood",
          title: "Likelihood",
          level: "foundations",
          reason: "Likelihood is the probability of the data under a model.",
        },
      ],
    },
    {
      id: "likelihood",
      title: "Likelihood",
      claim:
        "The likelihood of a model is how probable it makes the data you actually saw, and the best-fitting model is the one with the highest likelihood.",
      level: "foundations",
      minutes: 10,
      region: {
        id: "statistics",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "mixture-models",
          title: "Mixture models",
          level: "introductory",
          reason:
            "A mixture model is fitted by finding the proportions with the highest likelihood.",
        },
      ],
    },
    {
      id: "mixture-models",
      title: "Mixture models",
      claim:
        "A mixture model says each observation came from one of several sources in unknown proportions, and fitting it estimates those proportions.",
      level: "introductory",
      minutes: 12,
      region: {
        id: "statistics",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "em-algorithm",
          title: "The EM algorithm",
          level: "intermediate",
          reason:
            "EM is the standard way to fit a mixture model when the source of each observation is hidden.",
        },
      ],
    },
    {
      id: "em-algorithm",
      title: "The EM algorithm",
      claim:
        "The EM algorithm fits a mixture model by alternating two steps, sharing each observation among the sources by the current estimate and then re-estimating the proportions from those shares.",
      level: "intermediate",
      minutes: 15,
      region: {
        id: "statistics",
        name: "Statistics",
      },
      needed_by: [
        {
          id: "salmon",
          title: "Salmon",
          level: "intermediate",
          reason: "Salmon shares ambiguous reads among transcripts with EM.",
        },
      ],
    },
    {
      id: "tpm",
      title: "What TPM measures",
      claim:
        "TPM, transcripts per million, is each transcript's share of the transcript molecules in a sample, scaled so the shares add up to a million.",
      level: "introductory",
      minutes: 10,
      region: {
        id: "transcriptomics",
        name: "Transcriptomics",
      },
      needed_by: [
        {
          id: "salmon",
          title: "Salmon",
          level: "intermediate",
          reason: "Salmon reports each transcript's abundance in TPM.",
        },
      ],
    },
    {
      id: "salmon",
      title: "Salmon",
      claim:
        "Salmon estimates how much of each transcript a sample holds by mapping RNA-seq reads to the transcriptome and resolving reads that fit several transcripts with a probabilistic model.",
      level: "intermediate",
      minutes: 15,
      region: {
        id: "transcriptomics",
        name: "Transcriptomics",
      },
      needed_by: [],
    },
  ],
  span: {
    lowest: "first-steps",
    highest: "intermediate",
  },
  minutes: 152,
};
