(async function(){
  // Build a minimal 1-clip project so the export has something to encode, then run runExport directly
  // with a job object that has NO .label (only prog/frame/wrote/fail), matching how render-in-place or
  // other internal callers might invoke it, to prove job.label guards don't crash the pipeline.
  if (typeof newProject === 'function') newProject(true); // silent, skip unsaved-changes prompt if supported
  return typeof runExport;
})()
