import processDE from '../assets/topics/AgenticSWDevProcess_de.png';
import processEN from '../assets/topics/AgenticSWDevProcess_en.png';
import agent from '../assets/topics/Agent.png';

/** Bildpfade der redaktionellen Vorlage werden zu lokal gebauten Assets mit Dateihash. */
export const topicImages: Record<string, string> = {
  '../ressources/grafiken/Agent.png': agent,
  '../ressources/grafiken/AgenticSWDevProcess_de.png': processDE,
  '../ressources/grafiken/AgenticSWDevProcess_en.png': processEN,
};
