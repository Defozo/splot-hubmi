"""Verify final encoded sound and publish safe evidence for the submission package."""
import datetime,hashlib,json,subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'output/_video_work'
ART=ROOT/'artifacts'
qc=json.loads((WORK/'reports/pitch-final-technical-qc.json').read_text(encoding='utf-8'))
perception=json.loads(Path(qc.get('perceptualReportPath',WORK/'reports/final-native-video-review.json')).read_text(encoding='utf-8'))
targeted=json.loads((WORK/'reports/scene10-encoded-perception.json').read_text(encoding='utf-8'))
mix=json.loads((WORK/'manifests/pitch-audio-mix.json').read_text(encoding='utf-8'))
final=ROOT/'output/splot-demo.mp4'
sha=hashlib.sha256(final.read_bytes()).hexdigest()
assert sha==qc['finalSha256']==perception['sourceSha256']
assert perception['status']=='complete'
decoded,sr=sf.read(qc['audioDecodedPath'],always_2d=True)
reference,sr2=sf.read(WORK/'audio/pitch/final-mix.wav',always_2d=True)
assert sr==sr2==48000
size=min(len(decoded),len(reference))
correlation=float(np.corrcoef(decoded[:size].mean(axis=1),reference[:size].mean(axis=1))[0,1])
clipped=int(np.sum(np.abs(decoded)>=.9999))
stats=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(final),'-af','loudnorm=I=-18:TP=-1:LRA=7:print_format=json','-f','null','-'],capture_output=True,text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW)
assert stats.returncode==0
loudness=json.JSONDecoder().raw_decode(stats.stderr[stats.stderr.rfind('{'):])[0]
probe=qc['probe']
v=next(s for s in probe['streams'] if s['codec_type']=='video')
a=next(s for s in probe['streams'] if s['codec_type']=='audio')
delta=abs(float(v['duration'])-float(a['duration']))
tail=179-max(p['endSeconds'] for p in mix['placements'])
aligned=all(p['sceneStart']<=p['startSeconds']<p['endSeconds']<=p['sceneEnd'] for p in mix['placements'])
assert correlation>.99 and clipped==0 and delta<=.04 and tail>=1 and aligned
review=perception['review']
assert review['passed_for_clear_narration_and_quiet_background_music'] is True
assert targeted['status']=='complete'
targeted_review=json.loads(targeted['review'])
assert not targeted_review['pronunciation_issues'] and not targeted_review['actionable_findings']
finding_disposition=[{'id':'AV-01','timestampSeconds':101,'status':'not_confirmed_no_edit','reportedIssue':"Possible repeated initial consonant in 'Z zaakceptowanej Karty'.",'assessment':'The reviewed Polish script has two adjacent z consonants at a word boundary. A separate audio-capable model received only the actual final encoded 100.5 to 109.0 second excerpt, without transcript or the earlier diagnosis, and reported clear speech without a pronunciation issue or audible artifact. This does not substantiate a defect warranting modification of otherwise clear narration.','preservedGoodAudio':True}]
public_perception={k:perception[k] for k in ['createdAt','completedAt','model','actualModel','method','uploadedBytes','usage','review'] if k in perception}
public_perception.update(source='output/splot-demo.mp4',sourceSha256=sha,inputMimeType='video/mp4',actualSubmittedRangeSeconds=[0,179],humanListeningPerformed=False,coverageNormalization='The complete actual MP4 was supplied with native video/audio input. Coverage is tied to that file, not inferred from a transcript. Internal model sampling is not a claim that a human watched every frame.',discardedEarlierClaims='The earlier audio-only MP3 review included unsupported comments about video; those visual comments were rejected and are not evidence for this report.')
public_perception.update(findingDisposition=finding_disposition,timbreIdentificationCaveat='The model described an acoustic guitar timbre. The source composition uses deterministic synthesized pads, plucked keys, bass and percussion, with no guitar recording or outside samples. Perceived timbre is not evidence of musical provenance.',targetedFollowup={'method':targeted['method'],'model':targeted['model'],'actualModel':targeted.get('actualModel'),'inputMimeType':'audio/mpeg','sourceFinalSha256':sha,'actualSubmittedRangeSeconds':[100.5,109],'actualDurationSeconds':8.5,'audioSha256':targeted['audioSha256'],'rawReview':targeted_review,'coverageNormalization':'The excerpt is 8.5 seconds. The raw model duration estimate and approximate transcript are not accepted as exact measurements. This follow-up only assesses the reported speech hesitation, not music balance, provenance or video.'})
(ART/'media-perceptual-review.json').write_text(json.dumps(public_perception,ensure_ascii=False,indent=2),encoding='utf-8')
report={'schemaVersion':1,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'passed','finalSha256':sha,'audioPresent':True,'durationSeconds':179,'streams':[{'type':'video','codec':v['codec_name'],'width':v['width'],'height':v['height'],'fps':v['avg_frame_rate']},{'type':'audio','codec':a['codec_name'],'sampleRate':int(a['sample_rate']),'channels':a['channels'],'language':a.get('tags',{}).get('language')}],'technical':{'decodedWithoutErrors':qc['decodedWithoutErrors'],'decodedVideoFrames':qc['decodedVideoFrames'],'clipping':{'clippedSamples':clipped,'peakDbfs':round(20*np.log10(np.max(np.abs(decoded))),3)},'loudness':{'integratedLufs':float(loudness['input_i']),'truePeakDbtp':float(loudness['input_tp']),'rangeLu':float(loudness['input_lra'])},'sampleRate':sr,'channels':decoded.shape[1],'avDeltaSeconds':delta,'decodedVsMixCorrelation':correlation,'endTailSeconds':tail,'last10msPeak':float(np.max(np.abs(decoded[-480:])))},'perceptual':{'method':'Native audio and video input to an audio-capable multimodal model. Actual final MP4 bytes, no expected transcript or mix settings supplied. Automated perceptual review, not human listening.','model':perception['model'],'actualModel':perception.get('actualModel'),'sourceAudioSha256':qc['audioDecodedSha256'],'coverage':[{'start':0,'end':179,'input':'complete final MP4'}],'speechIntelligibility':review.get('speech'),'musicBalance':review.get('non_speech_audio'),'ending':review.get('editing'),'findings':review.get('actionable_findings'),'reportPaths':['artifacts/media-perceptual-review.json'],'humanListeningPerformed':False},'sync':{'sceneCount':len(mix['placements']),'allSpeechWithinScenes':aligned,'placements':[{'id':p['id'],'sceneStart':p['sceneStart'],'sceneEnd':p['sceneEnd'],'voiceStart':p['startSeconds'],'voiceEnd':p['endSeconds']} for p in mix['placements']],'placementsManifest':'output/_video_work/manifests/pitch-audio-mix.json'},'provenance':{'voice':'ElevenLabs Bella premade / eleven_v4 / paid payg output','music':'Original project composition Splot: spotkania. Deterministic oscillator synthesis in scripts/compose-demo-music.py, no external samples or borrowed melodies.','cloneUsed':False,'report':'artifacts/demo-audio-provenance.json'},'subtitles':{'language':'pl','cues':48,'words':300,'firstStart':.64,'lastEnd':177.5,'files':['output/splot-demo.srt','output/splot-demo.vtt'],'method':'Exact reviewed script force-aligned to the actual soundtrack; ASR kept separately as consistency evidence.'}}
report['perceptual']['findingDisposition']=finding_disposition
report['perceptual']['unresolvedConfirmedDefects']=[]
report['perceptual']['musicBalanceAssessment']='Music is audible and quiet beneath intelligible speech according to the final native MP4 review. The raw timbre identification is not used to establish provenance.'
report['subtitles']['burnedRail']={'count':18,'type':'Concise Polish scene summaries, separate from speech subtitles','completeSpeechTranscript':False}
report['subtitles']['sidecars']={'count':48,'type':'Complete spoken narration, SRT and VTT','burnedIntoVideo':False}
(ART/'audio-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
video_report={k:qc[k] for k in ['decodedWithoutErrors','durationWithin180s','sourceUiErrors','finalSha256','probe']}
video_report.update(audioVerification='artifacts/audio-verification.json',review={'coverage':'18 final scene frames reviewed directly, targeted full-resolution message frames 07 and08 reviewed after correction. Full actual MP4 submitted to native multimodal audiovisual review; reported separately. No human listening claim.','sourceEvidence':'output/_video_work/manifests/pitch-capture.json','allSourceUiCaptured':True,'generatedMediaUsed':True,'generatedMediaScope':'Narration from a licensed premade voice; original project-composed synthesized instrumental music. UI images are real browser recordings.','audioPresent':True,'captions':['output/splot-demo.srt','output/splot-demo.vtt','visible Polish summary rail'],'technicalReport':'output/_video_work/reports/pitch-final-technical-qc.json','perceptualReport':'artifacts/media-perceptual-review.json','correctedScenes':['07 author message visible in full','08 operator reply visible in full'],'team':'DEFOZO SOFTWARE HOUSE','author':'Michał Kiełtyka'},subtitleTrackAbsent=not any(s['codec_type']=='subtitle' for s in probe['streams']))
(ART/'demo-video-verification.json').write_text(json.dumps(video_report,ensure_ascii=False,indent=2),encoding='utf-8')
previous=json.loads((WORK/'versions/pitch-capture-v1.json').read_text(encoding='utf-8'))
current=json.loads((WORK/'manifests/pitch-capture.json').read_text(encoding='utf-8'))
changed=[]
for before,after in zip(previous['scenes'],current['scenes']):
    assert before['id']==after['id']
    if before['source']!=after['source']:
        changed.append({'id':after['id'],'beforeSourceSha256':hashlib.sha256(Path(before['source']).read_bytes()).hexdigest(),'afterSourceSha256':hashlib.sha256(Path(after['source']).read_bytes()).hexdigest(),'afterFinalFrameSha256':hashlib.sha256((Path(after['source']).parent/(after['id']+'-final.png')).read_bytes()).hexdigest()})
assert [item['id'] for item in changed]==['07-rozmowa-autorka','08-rozmowa-rops']
ledger={'schemaVersion':1,'maxCorrectionRounds':2,'correctionRoundsUsed':1,'correctionRoundsRemaining':1,'currentCandidateSha256':sha,'rounds':[{'round':1,'status':'implemented_verified','beforeCandidateSha256':'d62afe852bd2584034ff9cc22cd925719ceb9e53fae45840b35f0fb0c6eda9b2','afterCandidateSha256':sha,'timeRangesSeconds':[[83,90],[90,96]],'finding':'The completed message bubbles were partly outside the visible conversation viewport in the initial recording.','change':'Re-recorded the existing conversations in the author and operator sessions, scrolling the actual message into view and holding it for reading. No message was sent again.','confirmation':'The editor and coordinating agent independently inspected the resulting full-resolution PNG frames for both sessions and confirmed the author message and operator reply are visible.','evidence':changed,'unaffectedScenes':16,'audioMixSha256':qc['audioMixSha256'],'audioUnchanged':True,'beforeContactSheetSha256':hashlib.sha256((WORK/'versions/contact-sheet-pitch-v1.jpg').read_bytes()).hexdigest(),'afterContactSheetSha256':hashlib.sha256((WORK/'reports/contact-sheet.jpg').read_bytes()).hexdigest()}],'audioFindingDisposition':finding_disposition,'freshIndependentReview':'Separate reviewer receives the current candidate, source packet and plan after the first correction round. Its report is maintained separately.'}
(ART/'demo-video-correction-ledger.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2),encoding='utf-8')
if qc.get('version','').startswith('v3'):
    prior=json.loads((WORK/'versions/pitch-v2-evidence/demo-video-correction-ledger.json').read_text(encoding='utf-8'))
    retime=json.loads((WORK/'manifests/scene13-retiming-v3.json').read_text(encoding='utf-8'))
    prior.update(currentCandidateSha256=sha,correctionRoundsUsed=2,correctionRoundsRemaining=0)
    prior['rounds'].append({'round':2,'status':'implemented_verified','findingId':'FC-01','beforeCandidateSha256':'de4d640fb5163959c14ac9d48b67b5693772222528e3e8ef83a771cab2ef87b9','afterCandidateSha256':sha,'timeRangesSeconds':[[122,133]],'finding':'The feedback form reset at 123.20 seconds, before narration described its barrier and improvement at 125.46 to 132.28 seconds.','change':'Held the original filled-form frame through 132.32 seconds and retained the original send/reset/confirmation before 133 seconds. No new feedback was submitted.','retiming':retime,'unchangedScenes':17,'durationUnchanged':179,'audioUnchanged':qc['unchangedEncodedAac'],'frameEvidence':'artifacts/demo-video-frames.json','encodedComparison':'artifacts/demo-video-v3-comparison.json'})
    if qc['version']=='v3b':
        prior['rounds'][-1]['rejectedExecution']={'sha256':'47469b7ebe57d81416cede74e5f70e5a113ef337334e8db318d23c33d43fefb6','reason':'The first execution of the agreed second-round hold failed direct frame inspection. Re-executed that same correction with separately verified still and motion renders. No additional editorial round.'}
    (ART/'demo-video-correction-ledger.json').write_text(json.dumps(prior,ensure_ascii=False,indent=2),encoding='utf-8')
    report['technical']['unchangedEncodedAac']=qc['unchangedEncodedAac']
    report['perceptual']['priorAudioReviewTransfer']={'sourceCandidateSha256':'de4d640fb5163959c14ac9d48b67b5693772222528e3e8ef83a771cab2ef87b9','basis':'Encoded AAC is bit-for-bit identical in v2 and v3. Existing audio perception findings remain applicable to that same stream. The current complete MP4 was also supplied for a separate native audiovisual review.','aacSha256':qc['unchangedEncodedAac']['streams'][0]['sha256']}
    (ART/'audio-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    public_perception['targetedFollowup']['sourceOriginalFinalSha256']='de4d640fb5163959c14ac9d48b67b5693772222528e3e8ef83a771cab2ef87b9'
    public_perception['targetedFollowup']['reusedForCurrentCandidateBecause']='The encoded AAC stream was copied without re-encoding and its hash matches candidate v2.'
    public_perception['unchangedEncodedAac']=qc['unchangedEncodedAac']
    public_perception['findingDisposition']=finding_disposition
    public_perception['timbreIdentificationCaveat']='Perceived instrument and timbre labels are subjective model descriptions. Musical provenance is established by the local composition source and asset hashes, not inferred from timbre.'
    (ART/'media-perceptual-review.json').write_text(json.dumps(public_perception,ensure_ascii=False,indent=2),encoding='utf-8')
    video_report['review']['correctedScenes'].append('13 actual filled form held through spoken explanation, then actual original submission')
    video_report['review']['frameManifest']='artifacts/demo-video-frames.json'
    (ART/'demo-video-verification.json').write_text(json.dumps(video_report,ensure_ascii=False,indent=2),encoding='utf-8')
provenance=json.loads((ART/'demo-audio-provenance.json').read_text(encoding='utf-8'))
provenance['music']={'title':'Splot: spotkania','source':'Original project composition generated by scripts/compose-demo-music.py','method':'Deterministic local oscillator synthesis of pads, plucked keys, bass and light percussion. No external samples, recordings or borrowed melodies.','originalSha256':hashlib.sha256((WORK/'audio/pitch/original-instrumental.wav').read_bytes()).hexdigest(),'externalAttributionRequired':False,'rightsBasis':'Original material created for this project; no third-party music assets.'}
provenance['finalVideoSha256']=sha
(ART/'demo-audio-provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2),encoding='utf-8')
decisions_path=WORK/'manifests/edit-decisions.json'
decisions=json.loads(decisions_path.read_text(encoding='utf-8'))
decisions['stage']='visual edit and source mapping; separately mixed audio added at final assembly'
decisions['syntheticMedia']=False
decisions['syntheticMediaScope']='UI imagery only. All video images are actual browser capture. Narration and music are separate generated audio assets.'
decisions['audio']='Final delivery adds Polish ElevenLabs narration and original synthesized instrumental music; see pitch-audio-mix.json. This manifest maps the source video sequence.'
decisions['captions']={'burnedSummaryRails':18,'externalSpeechCues':48,'speechSidecars':['output/splot-demo.srt','output/splot-demo.vtt']}
decisions['finalDelivery']={'path':'output/splot-demo.mp4','sha256':sha,'technicalReport':'output/_video_work/reports/pitch-final-technical-qc.json'}
decisions_path.write_text(json.dumps(decisions,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'status':'passed','sha256':sha,'loudness':report['technical']['loudness'],'correlation':correlation,'tailSeconds':tail}))
